// @vitest-environment node
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

const { POST: SAVE, GET: LIST } = await import('@/app/api/storage/clinics/route');
const { GET: EXPORT } = await import('@/app/api/storage/export/route');
const { POST: IMPORT } = await import('@/app/api/storage/import/route');

function res(name: string, scanDate: string): V3AnalysisResult {
  return {
    input: { clinicFullName: name, clinicShortName: '연세두리치과', treatments: ['임플란트'], regions: ['가양역'] },
    settings: { chatgptCount: 3, geminiCount: 3 },
    scanDate, schemaVersion: 2,
    promptResults: [{
      prompt: { id: 'p1', text: 'q', displayText: '가양역 임플란트', category: '지역형' },
      chatgpt: { total: 3, answered: 0, failed: 3, mentions: 0, sov: 0, responseTexts: ['[오류]','[오류]','[오류]'], positions: [null,null,null], oks: [false,false,false] },
      gemini: { total: 3, answered: 3, failed: 0, mentions: 2, sov: 66.7, responseTexts: ['1. 연세두리치과의원 2. 서울맥치과의원','1. 연세두리치과의원','제일플란트치과'], positions: [1,1,null], oks: [true,true,true] },
    }],
    summary: {
      chatgpt: { total: 3, answered: 0, failed: 3, mentions: 0, sov: 0 },
      gemini: { total: 3, answered: 3, failed: 0, mentions: 2, sov: 66.7 },
      overall: { sov: 66.7 }, totalAnswered: 3, totalFailed: 3, bothVisibleRate: 0, avgPosition: 1,
    },
    competitorRankings: [{ name: '서울맥치과의원', mentions: 1, exposureRate: 33.3, avgPosition: 2 }],
    weakKeywords: [],
  };
}
const save = (r: V3AnalysisResult) => SAVE(new Request('http://x/', { method: 'POST', body: JSON.stringify(r) }));
const list = async () => (await LIST(new Request('http://x/'))).json() as Promise<{ clinics: ClinicRecord[] }>;
const exportAll = async () => JSON.parse(await (await EXPORT()).text());
const importBundle = (b: unknown) => IMPORT(new Request('http://x/', { method: 'POST', body: JSON.stringify(b) }));

beforeEach(() => store.clear());

describe('백업 복원', () => {
  it('저장소가 통째로 날아가도 백업으로 되살아난다', async () => {
    await save(res('연세두리치과의원', '2026-08-12T00:00:00.000Z'));
    const backup = await exportAll();

    store.clear(); // 저장소 소멸 재현
    expect((await list()).clinics).toHaveLength(0);
    console.log('\n저장소 초기화 후 치과 수: 0');

    const r = await importBundle(backup);
    const body = await r.json();
    expect(r.status).toBe(200);
    console.log('복원 결과:', JSON.stringify(body));

    const { clinics } = await list();
    expect(clinics).toHaveLength(1);
    expect(clinics[0].clinicFullName).toBe('연세두리치과의원');
    expect(clinics[0].scans[0].summary.gemini.sov).toBe(66.7);
    expect(clinics[0].scans[0].summary.totalFailed).toBe(3);
    expect(clinics[0].scans[0].promptResults[0].gemini.positions).toEqual([1, 1, null]);
  });

  it('응답 원문까지 되살아난다 (근거가 비지 않는다)', async () => {
    await save(res('연세두리치과의원', '2026-08-12T00:00:00.000Z'));
    const backup = await exportAll();
    store.clear();
    await importBundle(backup);

    const { clinics } = await list();
    const scanId = clinics[0].scans[0].id;
    const t = await (await LIST(new Request(`http://x/?scanId=${scanId}`))).json();
    expect(t.texts.byPrompt[0].gemini[0]).toContain('연세두리치과의원');
    expect(t.texts.byPrompt[0].chatgptOks).toEqual([false, false, false]);
    console.log('복원된 원문:', t.texts.byPrompt[0].gemini[0]);
  });

  it('같은 백업을 두 번 넣어도 스캔이 불어나지 않는다', async () => {
    await save(res('연세두리치과의원', '2026-08-12T00:00:00.000Z'));
    const backup = await exportAll();

    await importBundle(backup);
    const second = await (await importBundle(backup)).json();

    const { clinics } = await list();
    console.log('2회 복원 후 스캔 수:', clinics[0].scans.length, '| 건너뛴 중복:', second.scansSkipped);
    expect(clinics[0].scans).toHaveLength(1);
    expect(second.scansSkipped).toBe(1);
    expect(second.scansAdded).toBe(0);
  });

  it('기존 데이터가 있으면 지우지 않고 합친다', async () => {
    await save(res('연세두리치과의원', '2026-08-01T00:00:00.000Z'));
    const oldBackup = await exportAll();

    store.clear();
    await save(res('연세두리치과의원', '2026-08-12T00:00:00.000Z')); // 새 스캔만 있는 상태
    await importBundle(oldBackup);                                   // 옛 백업 복원

    const { clinics } = await list();
    const dates = clinics[0].scans.map(s => s.scanDate).sort();
    console.log('병합 후 스캔:', dates.join(', '));
    expect(clinics[0].scans).toHaveLength(2);
    expect(dates[0]).toContain('2026-08-01');
  });

  it('망가진 파일은 400으로 거절한다', async () => {
    expect((await importBundle({ nope: 1 })).status).toBe(400);
    expect((await importBundle({ clinics: [{ clinicFullName: '  ', scans: [] }] })).status).toBe(400);
    expect((await importBundle({ clinics: [{ clinicFullName: 'A치과', scans: 'not-array' }] })).status).toBe(400);
    console.log('형식 오류 3종 모두 400');
  });

  it('replace 모드는 기존 스캔을 백업 내용으로 갈아끼운다', async () => {
    await save(res('연세두리치과의원', '2026-08-01T00:00:00.000Z'));
    const backup = await exportAll();
    store.clear();
    await save(res('연세두리치과의원', '2026-08-12T00:00:00.000Z'));

    await importBundle({ ...backup, mode: 'replace' });
    const { clinics } = await list();
    console.log('replace 후 스캔 수:', clinics[0].scans.length, '| 날짜:', clinics[0].scans[0].scanDate);
    expect(clinics[0].scans).toHaveLength(1);
    expect(clinics[0].scans[0].scanDate).toContain('2026-08-01');
  });
});
