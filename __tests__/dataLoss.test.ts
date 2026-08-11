// @vitest-environment node
// 데이터가 '알아서 지워지는' 경로가 남아 있는지 실제로 돌려서 확인한다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { V3AnalysisResult, ClinicRecord } from '@/types/v3';

const store = new Map<string, unknown>();
vi.mock('@vercel/kv', () => ({
  kv: {
    get: async (k: string) => {
      const v = store.get(k);
      return v === undefined ? null : (v instanceof Set ? v : structuredClone(v));
    },
    set: async (k: string, v: unknown) => { store.set(k, structuredClone(v)); },
    del: async (k: string) => { store.delete(k); },
    sadd: async (k: string, ...m: string[]) => {
      const s = (store.get(k) as Set<string>) ?? new Set<string>();
      m.forEach(v => s.add(v)); store.set(k, s); return m.length;
    },
    srem: async (k: string, ...m: string[]) => {
      const s = (store.get(k) as Set<string>) ?? new Set<string>();
      m.forEach(v => s.delete(v)); store.set(k, s); return m.length;
    },
    smembers: async (k: string) => [...((store.get(k) as Set<string>) ?? new Set<string>())],
  },
}));

const { GET, POST, DELETE } = await import('@/app/api/storage/clinics/route');

function res(name: string, scanDate: string): V3AnalysisResult {
  return {
    input: { clinicFullName: name, clinicShortName: '', treatments: ['임플란트'], regions: ['강남역'] },
    settings: { chatgptCount: 3, geminiCount: 3 },
    scanDate, schemaVersion: 2,
    promptResults: [{
      prompt: { id: 'p1', text: 'q', displayText: 'q', category: '지역형' },
      chatgpt: { total: 3, answered: 3, failed: 0, mentions: 1, sov: 33.3, responseTexts: ['a','b','c'], positions: [1,null,null], oks: [true,true,true] },
      gemini: { total: 3, answered: 3, failed: 0, mentions: 2, sov: 66.7, responseTexts: ['a','b','c'], positions: [1,2,null], oks: [true,true,true] },
    }],
    summary: {
      chatgpt: { total: 3, answered: 3, failed: 0, mentions: 1, sov: 33.3 },
      gemini: { total: 3, answered: 3, failed: 0, mentions: 2, sov: 66.7 },
      overall: { sov: 50 }, totalAnswered: 6, totalFailed: 0, bothVisibleRate: 100, avgPosition: 1.3,
    },
    competitorRankings: [], weakKeywords: [],
  };
}
const post = (r: V3AnalysisResult) => POST(new Request('http://x/', { method: 'POST', body: JSON.stringify(r) }));
const list = () => GET(new Request('http://x/'));

beforeEach(() => store.clear());

describe('데이터 유실 경로 점검', () => {
  it('스캔 51건을 저장하면 가장 오래된 1건이 잘려나간다 (MAX_SCANS=50)', async () => {
    for (let i = 1; i <= 51; i++) {
      await post(res('상한치과의원', `2026-01-${String(i).padStart(2, '0')}T00:00:00.000Z`));
    }
    const { clinics } = await (await list()).json() as { clinics: ClinicRecord[] };
    const dates = clinics[0].scans.map(s => s.scanDate).sort();
    console.log(`\n저장 51건 → 보관 ${clinics[0].scans.length}건`);
    console.log('가장 오래된 보관분:', dates[0], '| 잘려나간 것: 2026-01-01');
    expect(clinics[0].scans).toHaveLength(50);
    expect(dates).not.toContain('2026-01-01T00:00:00.000Z');
  }, 60000);

  it('저장 실패해도 기존 데이터는 남는다', async () => {
    await post(res('보존치과의원', '2026-08-01T00:00:00.000Z'));
    // 잘못된 입력으로 저장 시도
    const bad = await POST(new Request('http://x/', { method: 'POST', body: '{"input":{"clinicFullName":"  "}}' }));
    expect(bad.status).toBe(400);

    const { clinics } = await (await list()).json() as { clinics: ClinicRecord[] };
    console.log('저장 실패 후에도 기존 치과 살아있음:', clinics.map(c => c.clinicFullName).join(', '));
    expect(clinics.find(c => c.clinicFullName === '보존치과의원')?.scans).toHaveLength(1);
  });

  it('다른 치과를 저장해도 기존 치과가 사라지지 않는다', async () => {
    await post(res('가치과의원', '2026-08-01T00:00:00.000Z'));
    await post(res('나치과의원', '2026-08-02T00:00:00.000Z'));
    await post(res('다치과의원', '2026-08-03T00:00:00.000Z'));
    const { clinics } = await (await list()).json() as { clinics: ClinicRecord[] };
    console.log('3개 순차 저장 후 생존:', clinics.map(c => c.clinicFullName).join(', '));
    expect(clinics).toHaveLength(3);
  });

  it('조회만 반복해도 데이터가 줄지 않는다', async () => {
    await post(res('조회치과의원', '2026-08-01T00:00:00.000Z'));
    for (let i = 0; i < 5; i++) await list();
    const { clinics } = await (await list()).json() as { clinics: ClinicRecord[] };
    console.log('6회 조회 후 스캔 수:', clinics[0].scans.length);
    expect(clinics[0].scans).toHaveLength(1);
  });

  it('삭제는 지정한 치과만 지운다', async () => {
    await post(res('남을치과의원', '2026-08-01T00:00:00.000Z'));
    await post(res('지울치과의원', '2026-08-02T00:00:00.000Z'));
    await DELETE(new Request('http://x/', { method: 'DELETE', body: JSON.stringify({ clinicName: '지울치과의원' }) }));
    const { clinics } = await (await list()).json() as { clinics: ClinicRecord[] };
    console.log('삭제 후 남은 치과:', clinics.map(c => c.clinicFullName).join(', '));
    expect(clinics.map(c => c.clinicFullName)).toEqual(['남을치과의원']);
  });

  it('저장 데이터에 만료(TTL)가 걸려 있지 않다', async () => {
    const src = await import('node:fs').then(fs => fs.readFileSync('src/app/api/storage/clinics/route.ts', 'utf8'));
    // kv.set에 ex/px/exat 같은 만료 옵션이 붙어 있으면 시간이 지나 데이터가 사라진다
    expect(src).not.toMatch(/kv\.set\([^)]*\{[^}]*\b(ex|px|exat|pxat)\b/);
    expect(src).not.toMatch(/kv\.expire\(/);
    console.log('kv.set에 만료 옵션 없음 · kv.expire 호출 없음');
  });
});
