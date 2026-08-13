import { describe, it, expect } from 'vitest';
import { buildMonthlyReport } from '@/utils/monthlyReport';
import type { SavedScan, CompetitorRank, CitationSource } from '@/types/v3';
import type { WeakKeyword } from '@/types/ranking';

function scan(over: {
  date: string;
  sov: number;
  avgPosition: number | null;
  competitors?: CompetitorRank[];
  citations?: CitationSource[];
  weak?: string[];
}): SavedScan {
  return {
    id: `s-${over.date}`,
    scanDate: over.date,
    schemaVersion: 2,
    input: { clinicFullName: '연세두리치과의원', clinicShortName: '연세두리치과', treatments: ['임플란트'], regions: ['가양역'] },
    settings: { chatgptCount: 3, geminiCount: 3 },
    promptResults: [],
    summary: {
      chatgpt: { total: 3, answered: 3, failed: 0, mentions: 1, sov: over.sov },
      gemini: { total: 3, answered: 3, failed: 0, mentions: 1, sov: over.sov },
      overall: { sov: over.sov },
      totalAnswered: 6, totalFailed: 0, bothVisibleRate: 50,
      avgPosition: over.avgPosition,
    },
    competitorRankings: over.competitors ?? [],
    weakKeywords: (over.weak ?? []).map<WeakKeyword>(k => ({
      keyword: k, reason: 'absent', bestPosition: null, topCompetitors: [],
    })),
    citations: over.citations ?? [],
    searchQueries: [],
  };
}

const comp = (name: string, rate: number, isTarget = false): CompetitorRank =>
  ({ name, mentions: 1, exposureRate: rate, avgPosition: 2, isTarget });
const cite = (domain: string): CitationSource => ({ domain, count: 1, rate: 10 });

describe('월간 비교 리포트', () => {
  it('스캔이 1건뿐이면 비교할 수 없다', () => {
    expect(buildMonthlyReport([])).toBeNull();
    expect(buildMonthlyReport([scan({ date: '2026-08-01T00:00:00.000Z', sov: 20, avgPosition: 2 })])).toBeNull();
  });

  it('SOV 증감을 계산한다', () => {
    const r = buildMonthlyReport([
      scan({ date: '2026-07-01T00:00:00.000Z', sov: 20, avgPosition: 3 }),
      scan({ date: '2026-08-01T00:00:00.000Z', sov: 35, avgPosition: 2 }),
    ])!;
    expect(r.sov).toEqual({ current: 35, previous: 20, delta: 15 });
    expect(r.spanDays).toBe(31);
    console.log('\nSOV', r.sov.previous + '% →', r.sov.current + '%', '(' + r.sov.delta + '%p)');
  });

  it('순위는 낮아지는 게 개선이므로 부호를 뒤집어 준다', () => {
    const r = buildMonthlyReport([
      scan({ date: '2026-07-01T00:00:00.000Z', sov: 20, avgPosition: 4 }),
      scan({ date: '2026-08-01T00:00:00.000Z', sov: 20, avgPosition: 1.5 }),
    ])!;
    // 4위 → 1.5위는 개선. delta는 양수여야 한다.
    expect(r.position.delta).toBe(2.5);
    console.log('순위', r.position.previous + '위 →', r.position.current + '위 (개선 +' + r.position.delta + ')');
  });

  it('순위가 밀리면 음수로 나온다', () => {
    const r = buildMonthlyReport([
      scan({ date: '2026-07-01T00:00:00.000Z', sov: 20, avgPosition: 1 }),
      scan({ date: '2026-08-01T00:00:00.000Z', sov: 20, avgPosition: 3 }),
    ])!;
    expect(r.position.delta).toBe(-2);
  });

  it('미노출이면 순위 비교를 건너뛴다', () => {
    const r = buildMonthlyReport([
      scan({ date: '2026-07-01T00:00:00.000Z', sov: 0, avgPosition: null }),
      scan({ date: '2026-08-01T00:00:00.000Z', sov: 10, avgPosition: 2 }),
    ])!;
    expect(r.position.delta).toBeNull();
    expect(r.position.previous).toBeNull();
  });

  it('치고 올라온 경쟁사와 밀려난 경쟁사를 가른다', () => {
    const r = buildMonthlyReport([
      scan({ date: '2026-07-01T00:00:00.000Z', sov: 20, avgPosition: 2,
        competitors: [comp('서울맥치과의원', 40), comp('고르다치과의원', 30), comp('사라질치과의원', 20)] }),
      scan({ date: '2026-08-01T00:00:00.000Z', sov: 20, avgPosition: 2,
        competitors: [comp('서울맥치과의원', 55), comp('고르다치과의원', 10), comp('신규치과의원', 25)] }),
    ])!;

    console.log('상승:', r.risingCompetitors.map(c => `${c.name} ${c.previousRate}→${c.currentRate}%`).join(', '));
    console.log('하락:', r.fallingCompetitors.map(c => `${c.name} ${c.previousRate}→${c.currentRate}%`).join(', '));

    expect(r.risingCompetitors.map(c => c.name)).toEqual(['신규치과의원', '서울맥치과의원']);
    expect(r.risingCompetitors[0].delta).toBe(25);
    expect(r.fallingCompetitors.map(c => c.name)).toEqual(['고르다치과의원', '사라질치과의원']);
    // 목록에서 사라진 경쟁사는 0%로 떨어진 것으로 본다
    expect(r.fallingCompetitors.find(c => c.name === '사라질치과의원')?.currentRate).toBe(0);
  });

  it('우리 병원은 경쟁사 판도에서 제외한다', () => {
    const r = buildMonthlyReport([
      scan({ date: '2026-07-01T00:00:00.000Z', sov: 20, avgPosition: 2,
        competitors: [comp('연세두리치과의원', 20, true), comp('서울맥치과의원', 40)] }),
      scan({ date: '2026-08-01T00:00:00.000Z', sov: 31, avgPosition: 2,
        competitors: [comp('연세두리치과의원', 31, true), comp('서울맥치과의원', 55)] }),
    ])!;
    const names = [...r.risingCompetitors, ...r.fallingCompetitors].map(c => c.name);
    console.log('경쟁사 목록:', names.join(', '));
    expect(names).not.toContain('연세두리치과의원');
    expect(names).toContain('서울맥치과의원');
  });

  it('새로 생긴 인용 출처와 사라진 출처를 구분한다', () => {
    const r = buildMonthlyReport([
      scan({ date: '2026-07-01T00:00:00.000Z', sov: 20, avgPosition: 2,
        citations: [cite('goodoc.co.kr'), cite('modoodoc.com')] }),
      scan({ date: '2026-08-01T00:00:00.000Z', sov: 20, avgPosition: 2,
        citations: [cite('goodoc.co.kr'), cite('ysdoori.co.kr')] }),
    ])!;
    expect(r.newCitations).toEqual(['ysdoori.co.kr']);
    expect(r.lostCitations).toEqual(['modoodoc.com']);
    console.log('신규 출처:', r.newCitations.join(', '), '| 이탈:', r.lostCitations.join(', '));
  });

  it('해결된 취약 키워드와 새로 생긴 취약 키워드를 뽑는다', () => {
    const r = buildMonthlyReport([
      scan({ date: '2026-07-01T00:00:00.000Z', sov: 20, avgPosition: 2, weak: ['가양역 임플란트 가격', '등촌동 사랑니'] }),
      scan({ date: '2026-08-01T00:00:00.000Z', sov: 20, avgPosition: 2, weak: ['등촌동 사랑니', '강서구 교정'] }),
    ])!;
    expect(r.fixedKeywords).toEqual(['가양역 임플란트 가격']);
    expect(r.newWeakKeywords).toEqual(['강서구 교정']);
    console.log('해결:', r.fixedKeywords.join(', '), '| 신규 약점:', r.newWeakKeywords.join(', '));
  });

  it('순서가 뒤섞여 들어와도 최신 두 건을 고른다', () => {
    const r = buildMonthlyReport([
      scan({ date: '2026-06-01T00:00:00.000Z', sov: 5, avgPosition: 5 }),
      scan({ date: '2026-08-01T00:00:00.000Z', sov: 35, avgPosition: 2 }),
      scan({ date: '2026-07-01T00:00:00.000Z', sov: 20, avgPosition: 3 }),
    ])!;
    expect(r.currentDate).toContain('2026-08-01');
    expect(r.previousDate).toContain('2026-07-01');
    expect(r.sov.delta).toBe(15);
  });
});
