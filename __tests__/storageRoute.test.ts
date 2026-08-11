// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { V3AnalysisResult, ClinicRecord, ScanTexts } from '@/types/v3';

// 인메모리 KV — 실 Upstash 인스턴스가 없어 라우트 로직만 검증한다
const store = new Map<string, unknown>();
vi.mock('@vercel/kv', () => ({
  kv: {
    get: async (k: string) => {
      const v = store.get(k);
      return v === undefined || v instanceof Set ? (v === undefined ? null : v) : structuredClone(v);
    },
    set: async (k: string, v: unknown) => { store.set(k, structuredClone(v)); },
    del: async (k: string) => { store.delete(k); },
    incr: async (k: string) => { const n = ((store.get(k) as number) ?? 0) + 1; store.set(k, n); return n; },
    expire: async () => {},
    // Set 연산은 원자적이다 — 실제 Redis와 같게 동작시킨다
    sadd: async (k: string, ...m: string[]) => {
      const s = (store.get(k) as Set<string>) ?? new Set<string>();
      m.forEach(v => s.add(v));
      store.set(k, s);
      return m.length;
    },
    srem: async (k: string, ...m: string[]) => {
      const s = (store.get(k) as Set<string>) ?? new Set<string>();
      m.forEach(v => s.delete(v));
      store.set(k, s);
      return m.length;
    },
    smembers: async (k: string) => [...((store.get(k) as Set<string>) ?? new Set<string>())],
  },
}));

const { GET, POST, DELETE } = await import('@/app/api/storage/clinics/route');

function makeResult(clinicFullName: string, scanDate = '2026-08-11T00:00:00.000Z'): V3AnalysisResult {
  return {
    input: { clinicFullName, clinicShortName: '', treatments: ['임플란트'], regions: ['강남역'] },
    settings: { chatgptCount: 3, geminiCount: 3 },
    scanDate,
    schemaVersion: 2,
    promptResults: [{
      prompt: { id: 'p1', text: 'q', displayText: 'q', category: '지역형' },
      chatgpt: { total: 3, answered: 0, failed: 3, mentions: 0, sov: 0, responseTexts: ['[오류] x', '[오류] x', '[오류] x'], positions: [null, null, null], oks: [false, false, false] },
      gemini: { total: 3, answered: 3, failed: 0, mentions: 3, sov: 100, responseTexts: ['1. 하루플란트치과', '1. 하루플란트치과', '2. 하루플란트치과'], positions: [1, 1, 2], oks: [true, true, true] },
    }],
    summary: {
      chatgpt: { total: 3, answered: 0, failed: 3, mentions: 0, sov: 0 },
      gemini: { total: 3, answered: 3, failed: 0, mentions: 3, sov: 100 },
      overall: { sov: 100 }, totalAnswered: 3, totalFailed: 3, bothVisibleRate: 0, avgPosition: 1.3,
    },
    competitorRankings: [],
    weakKeywords: [],
  };
}

const post = (r: V3AnalysisResult) => POST(new Request('http://x/api/storage/clinics', { method: 'POST', body: JSON.stringify(r) }));
const list = () => GET(new Request('http://x/api/storage/clinics'));
const texts = (id: string) => GET(new Request(`http://x/api/storage/clinics?scanId=${id}`));
const del = (body: unknown) => DELETE(new Request('http://x/api/storage/clinics', { method: 'DELETE', body: JSON.stringify(body) }));

beforeEach(() => store.clear());

describe('storage route — 저장/조회/삭제 왕복', () => {
  it('저장 후 조회하면 치과가 나온다', async () => {
    expect((await post(makeResult('하루플란트치과의원'))).status).toBe(200);
    const { clinics } = await (await list()).json();
    expect(clinics).toHaveLength(1);
    expect(clinics[0].clinicFullName).toBe('하루플란트치과의원');
    expect(clinics[0].scans).toHaveLength(1);
  });

  it('응답 원문이 별도 키에 저장되고 다시 읽힌다', async () => {
    const { scanId } = await (await post(makeResult('하루플란트치과의원'))).json();
    const { texts: t } = await (await texts(scanId)).json() as { texts: ScanTexts };
    expect(t.byPrompt[0].gemini).toHaveLength(3);
    expect(t.byPrompt[0].gemini[0]).toContain('하루플란트치과');
    expect(t.byPrompt[0].chatgptOks).toEqual([false, false, false]);
  });

  it('목록 레코드에는 원문이 섞여 들어가지 않는다 (조회 경량화)', async () => {
    await post(makeResult('하루플란트치과의원'));
    const { clinics } = await (await list()).json();
    expect(JSON.stringify(clinics)).not.toContain('하루플란트치과의원이 좋습니다');
    expect(clinics[0].scans[0].promptResults[0].gemini).not.toHaveProperty('responseTexts');
    expect(clinics[0].scans[0].promptResults[0].gemini.positions).toEqual([1, 1, 2]);
  });

  it('서로 다른 치과를 동시에 저장해도 둘 다 살아남는다', async () => {
    await Promise.all([
      post(makeResult('가치과의원')),
      post(makeResult('나치과의원')),
      post(makeResult('다치과의원')),
    ]);
    const { clinics } = await (await list()).json();
    expect(clinics.map((c: ClinicRecord) => c.clinicFullName).sort())
      .toEqual(['가치과의원', '나치과의원', '다치과의원']);
  });

  it('같은 치과 표기가 달라도 한 레코드로 모인다 (canonicalKey)', async () => {
    await post(makeResult('하루플란트치과의원', '2026-08-01T00:00:00.000Z'));
    await post(makeResult('하루플란트치과', '2026-08-11T00:00:00.000Z'));
    const { clinics } = await (await list()).json();
    expect(clinics).toHaveLength(1);
    expect(clinics[0].scans).toHaveLength(2);
  });

  it('스캔 1건 삭제 시 원문도 함께 지운다', async () => {
    const { scanId } = await (await post(makeResult('하루플란트치과의원'))).json();
    await post(makeResult('하루플란트치과의원', '2026-08-12T00:00:00.000Z'));
    await del({ clinicName: '하루플란트치과의원', scanId });

    const { clinics } = await (await list()).json();
    expect(clinics[0].scans).toHaveLength(1);
    const { texts: t } = await (await texts(scanId)).json();
    expect(t).toBeNull();
  });

  it('치과 삭제 시 인덱스에서도 빠진다', async () => {
    await post(makeResult('하루플란트치과의원'));
    await del({ clinicName: '하루플란트치과의원' });
    const { clinics } = await (await list()).json();
    expect(clinics).toHaveLength(0);
    expect([...(store.get('geo:index') as Set<string>)]).toEqual([]);
  });

  it('잘못된 입력은 400으로 막는다', async () => {
    const bad = { ...makeResult('x'), input: { clinicFullName: '  ', clinicShortName: '', treatments: [], regions: [] } };
    expect((await post(bad as V3AnalysisResult)).status).toBe(400);
    expect((await del({})).status).toBe(400);
  });
});

describe('storage route — 구 스키마 마이그레이션', () => {
  it('단일 키에 있던 데이터를 치과별 키로 옮기고 옛 키를 지운다', async () => {
    const legacyRecord = {
      clinicFullName: '옛날치과의원',
      clinicShortName: '옛날치과',
      lastUpdated: '2026-04-25T00:00:00.000Z',
      scans: [{ id: 'old-1', scanDate: '2026-04-25T00:00:00.000Z' }],
    };
    store.set('geo-clinics-v2', { '옛날치과의원': legacyRecord });

    const { clinics } = await (await list()).json();
    expect(clinics).toHaveLength(1);
    expect(clinics[0].clinicFullName).toBe('옛날치과의원');
    expect(clinics[0].schemaVersion).toBe(2);
    expect(store.get('geo-clinics-v2')).toBeUndefined();
    expect(store.get('geo:clinic:옛날치과')).toBeTruthy();
  });

  it('마이그레이션 후 재조회해도 중복되지 않는다', async () => {
    store.set('geo-clinics-v2', { 'A치과의원': { clinicFullName: 'A치과의원', clinicShortName: '', lastUpdated: '2026-04-25T00:00:00.000Z', scans: [] } });
    await list();
    const { clinics } = await (await list()).json();
    expect(clinics).toHaveLength(1);
  });
});
