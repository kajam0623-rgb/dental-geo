// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ClinicRecord, V3AnalysisResult } from '@/types/v3';

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
    smembers: async (k: string) => [...((store.get(k) as Set<string>) ?? new Set<string>())],
  },
}));

// 실 API를 타지 않도록 분석 함수를 대체한다
const scanCalls: string[] = [];
vi.mock('@/utils/analyze', () => ({
  runAnalysisV3: async (input: { clinicFullName: string }) => {
    scanCalls.push(input.clinicFullName);
    const r: V3AnalysisResult = {
      input: input as V3AnalysisResult['input'],
      settings: { chatgptCount: 3, geminiCount: 3 },
      scanDate: new Date().toISOString(),
      schemaVersion: 2,
      promptResults: [{
        prompt: { id: 'p1', text: 'q', displayText: 'q', category: '지역형' },
        chatgpt: { total: 3, answered: 3, failed: 0, mentions: 1, sov: 33.3, responseTexts: ['a','b','c'], positions: [1,null,null], oks: [true,true,true] },
        gemini: { total: 3, answered: 3, failed: 0, mentions: 2, sov: 66.7, responseTexts: ['a','b','c'], positions: [1,2,null], oks: [true,true,true] },
      }],
      summary: {
        chatgpt: { total: 3, answered: 3, failed: 0, mentions: 1, sov: 33.3 },
        gemini: { total: 3, answered: 3, failed: 0, mentions: 2, sov: 66.7 },
        overall: { sov: 50 }, totalAnswered: 6, totalFailed: 0, bothVisibleRate: 100, avgPosition: 1.5,
      },
      competitorRankings: [], weakKeywords: [], citations: [], searchQueries: [],
    };
    return r;
  },
}));

const { GET } = await import('@/app/api/cron/monthly-scan/route');
const { canonicalKey } = await import('@/utils/ranking');
const ckey = (name: string) => `geo:clinic:${canonicalKey(name)}`;
const req = (auth?: string) =>
  new Request('http://x/api/cron/monthly-scan', { headers: auth ? { authorization: auth } : {} });

function seed(name: string, lastUpdatedDaysAgo: number) {
  const iso = new Date(Date.now() - lastUpdatedDaysAgo * 86400000).toISOString();
  const key = ckey(name);
  const record: ClinicRecord = {
    clinicFullName: name,
    clinicShortName: '',
    schemaVersion: 2,
    lastUpdated: iso,
    scans: [{
      id: 'old', scanDate: iso, schemaVersion: 2,
      input: { clinicFullName: name, clinicShortName: '', treatments: ['임플란트'], regions: ['가양역'] },
      settings: { chatgptCount: 3, geminiCount: 3 },
      promptResults: [{
        prompt: { id: 'p1', text: 'q', displayText: 'q', category: '지역형' },
        chatgpt: { total: 3, answered: 3, failed: 0, mentions: 1, sov: 33.3, positions: [1,null,null] },
        gemini: { total: 3, answered: 3, failed: 0, mentions: 1, sov: 33.3, positions: [1,null,null] },
      }],
      summary: {
        chatgpt: { total: 3, answered: 3, failed: 0, mentions: 1, sov: 33.3 },
        gemini: { total: 3, answered: 3, failed: 0, mentions: 1, sov: 33.3 },
        overall: { sov: 33.3 }, totalAnswered: 6, totalFailed: 0, bothVisibleRate: 100, avgPosition: 2,
      },
      competitorRankings: [], weakKeywords: [], citations: [], searchQueries: [],
    }],
  };
  store.set(key, record);
  const idx = (store.get('geo:index') as Set<string>) ?? new Set<string>();
  idx.add(key);
  store.set('geo:index', idx);
}

beforeEach(() => { store.clear(); scanCalls.length = 0; delete process.env.CRON_SECRET; });

describe('월간 자동 재스캔', () => {
  it('오래된 치과를 재스캔하고 스캔을 쌓는다', async () => {
    seed('오래된치과의원', 45);
    const body = await (await GET(req())).json();
    console.log('\n결과:', JSON.stringify({ scanned: body.scanned, skipped: body.skipped }));

    expect(body.success).toBe(true);
    expect(body.scanned).toEqual(['오래된치과의원']);
    const rec = store.get(ckey('오래된치과의원')) as ClinicRecord;
    expect(rec.scans).toHaveLength(2);
    console.log('스캔 누적:', rec.scans.length, '건 → 월간 비교가 가능해진다');
  });

  it('최근에 스캔한 치과는 건너뛴다 (수동 스캔과 중복 방지)', async () => {
    seed('최근치과의원', 3);
    const body = await (await GET(req())).json();
    console.log('건너뜀:', body.skipped);
    expect(body.scanned).toEqual([]);
    expect(body.skipped).toEqual(['최근치과의원']);
    expect(scanCalls).toHaveLength(0);
  });

  it('직전 스캔의 프롬프트·설정을 그대로 재사용한다 (조건이 바뀌면 비교 불가)', async () => {
    seed('조건치과의원', 40);
    await GET(req());
    const rec = store.get(ckey('조건치과의원')) as ClinicRecord;
    expect(rec.scans[0].settings).toEqual(rec.scans[1].settings);
    expect(rec.scans[0].promptResults[0].prompt.id).toBe(rec.scans[1].promptResults[0].prompt.id);
    console.log('프롬프트 id 동일:', rec.scans[0].promptResults[0].prompt.id);
  });

  it('오래 방치된 치과를 먼저 처리한다', async () => {
    seed('나중치과의원', 31);
    seed('먼저치과의원', 90);
    await GET(req());
    console.log('처리 순서:', scanCalls.join(' → '));
    expect(scanCalls[0]).toBe('먼저치과의원');
  });

  it('CRON_SECRET이 있으면 올바른 헤더만 통과시킨다', async () => {
    process.env.CRON_SECRET = 'sec';
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('Bearer sec'))).status).toBe(200);
  });

  it('저장된 치과가 없어도 정상 응답한다', async () => {
    const body = await (await GET(req())).json();
    expect(body.success).toBe(true);
    expect(body.scanned).toEqual([]);
  });
});

describe('vercel.json 크론 설정', () => {
  it('Hobby 제약(최대 2개)을 지키고 월 1회로 잡혀 있다', async () => {
    const fs = await import('node:fs');
    const cfg = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    expect(cfg.crons.length).toBeLessThanOrEqual(2);

    const monthly = cfg.crons.find((c: { path: string }) => c.path === '/api/cron/monthly-scan');
    expect(monthly).toBeTruthy();

    const [min, hour, dom, mon, dow] = monthly.schedule.split(/\s+/);
    // 일(day-of-month)이 고정이어야 월 1회다
    expect(dom).toMatch(/^\d+$/);
    expect(mon).toBe('*');
    expect(dow).toBe('*');
    expect(monthly.schedule).not.toMatch(/[A-Za-z]/);
    console.log('월간 크론:', monthly.schedule, `→ 매월 ${dom}일 UTC ${hour}:${min.padStart(2,'0')} (KST ${(Number(hour)+9)%24}시)`);
  });
});
