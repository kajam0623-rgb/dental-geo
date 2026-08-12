// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { V3AnalysisResult } from '@/types/v3';

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

const { POST } = await import('@/app/api/storage/clinics/route');
const { GET: EXPORT } = await import('@/app/api/storage/export/route');

function res(name: string, scanDate: string): V3AnalysisResult {
  return {
    input: { clinicFullName: name, clinicShortName: '', treatments: ['임플란트'], regions: ['가양역'] },
    settings: { chatgptCount: 3, geminiCount: 3 },
    scanDate, schemaVersion: 2,
    promptResults: [{
      prompt: { id: 'p1', text: 'q', displayText: '가양역 임플란트', category: '지역형' },
      chatgpt: { total: 3, answered: 0, failed: 3, mentions: 0, sov: 0, responseTexts: ['[오류] no credits','[오류] no credits','[오류] no credits'], positions: [null,null,null], oks: [false,false,false] },
      gemini: { total: 3, answered: 3, failed: 0, mentions: 2, sov: 66.7, responseTexts: ['1. 연세두리치과의원 2. 서울맥치과의원','1. 연세두리치과의원','제일플란트치과'], positions: [1,1,null], oks: [true,true,true] },
    }],
    summary: {
      chatgpt: { total: 3, answered: 0, failed: 3, mentions: 0, sov: 0 },
      gemini: { total: 3, answered: 3, failed: 0, mentions: 2, sov: 66.7 },
      overall: { sov: 66.7 }, totalAnswered: 3, totalFailed: 3, bothVisibleRate: 0, avgPosition: 1,
    },
    competitorRankings: [{ name: '서울맥치과의원', mentions: 1, exposureRate: 33.3, avgPosition: 2 }],
    weakKeywords: [],
    citations: [],
    searchQueries: [],
  };
}
const save = (r: V3AnalysisResult) => POST(new Request('http://x/', { method: 'POST', body: JSON.stringify(r) }));

beforeEach(() => store.clear());

describe('백업 내보내기', () => {
  it('다운로드 헤더와 파일명이 붙는다', async () => {
    await save(res('연세두리치과의원', '2026-08-12T00:00:00.000Z'));
    const r = await EXPORT();
    expect(r.headers.get('content-type')).toContain('application/json');
    const cd = r.headers.get('content-disposition') ?? '';
    expect(cd).toContain('attachment');
    expect(cd).toMatch(/dental-geo-backup-\d{4}-\d{2}-\d{2}\.json/);
    console.log('\n헤더:', cd);
  });

  it('치과·스캔·응답 원문이 전부 담긴다', async () => {
    await save(res('연세두리치과의원', '2026-08-12T00:00:00.000Z'));
    await save(res('하루플란트치과의원', '2026-08-11T00:00:00.000Z'));

    const bundle = JSON.parse(await (await EXPORT()).text());
    console.log('치과', bundle.clinicCount, '개 · 스캔', bundle.scanCount, '건 · 원문 레코드', Object.keys(bundle.texts).length, '건');

    expect(bundle.clinicCount).toBe(2);
    expect(bundle.scanCount).toBe(2);
    expect(bundle.schemaVersion).toBe(2);

    // 원문이 실제로 들어있어야 복원 가치가 있다
    const allTexts = JSON.stringify(bundle.texts);
    expect(allTexts).toContain('연세두리치과의원');
    expect(allTexts).toContain('[오류] no credits');
    console.log('원문 샘플:', Object.values(bundle.texts as Record<string, { byPrompt: Array<{ gemini: string[] }> }>)[0].byPrompt[0].gemini[0]);
  });

  it('순위·경쟁사·실패건수 같은 집계도 보존된다', async () => {
    await save(res('연세두리치과의원', '2026-08-12T00:00:00.000Z'));
    const bundle = JSON.parse(await (await EXPORT()).text());
    const scan = bundle.clinics[0].scans[0];
    expect(scan.summary.gemini.sov).toBe(66.7);
    expect(scan.summary.totalFailed).toBe(3);
    expect(scan.promptResults[0].gemini.positions).toEqual([1, 1, null]);
    expect(scan.competitorRankings[0].name).toBe('서울맥치과의원');
    console.log('집계 보존 확인 · SOV', scan.summary.gemini.sov + '% · 실패', scan.summary.totalFailed, '건');
  });

  it('저장된 게 없어도 빈 번들을 정상 반환한다', async () => {
    const r = await EXPORT();
    const bundle = JSON.parse(await r.text());
    expect(r.status).toBe(200);
    expect(bundle.clinicCount).toBe(0);
    expect(bundle.clinics).toEqual([]);
  });
});
