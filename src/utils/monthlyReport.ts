// 저장된 스캔 두 건을 비교해 '지난달 대비 무엇이 달라졌는가'를 뽑는다.
// 외부 API를 타지 않는 순수 함수라 단위 테스트로 전부 검증한다.

import type { SavedScan } from '@/types/v3';

export interface MetricChange {
  current: number | null;
  previous: number | null;
  delta: number | null;
}

export interface CompetitorMove {
  name: string;
  currentRate: number;
  previousRate: number;
  delta: number;
}

export interface MonthlyReport {
  currentDate: string;
  previousDate: string;
  /** 두 스캔 사이 간격(일) */
  spanDays: number;
  sov: MetricChange;
  /** 평균 추천 순위 — 낮을수록 좋으므로 delta 부호를 뒤집어 '개선=양수'로 맞춘다 */
  position: MetricChange;
  /** 새로 치고 올라온 경쟁사 */
  risingCompetitors: CompetitorMove[];
  /** 밀려난 경쟁사 */
  fallingCompetitors: CompetitorMove[];
  /** 이번 달 새로 등장한 인용 출처 */
  newCitations: string[];
  /** 이번 달 사라진 인용 출처 */
  lostCitations: string[];
  /** 해결된 취약 키워드 */
  fixedKeywords: string[];
  /** 새로 생긴 취약 키워드 */
  newWeakKeywords: string[];
}

const round1 = (n: number) => Number(n.toFixed(1));

/**
 * 가장 최근 스캔과 그 직전 스캔을 비교한다.
 * 스캔이 1건뿐이면 비교 대상이 없으므로 null.
 */
export function buildMonthlyReport(scans: SavedScan[]): MonthlyReport | null {
  if (!Array.isArray(scans) || scans.length < 2) return null;

  const sorted = [...scans].sort(
    (a, b) => new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime(),
  );
  const current = sorted[0];
  const previous = sorted[1];

  const curSov = current.summary.overall.sov;
  const prevSov = previous.summary.overall.sov;

  const curPos = current.summary.avgPosition;
  const prevPos = previous.summary.avgPosition;
  // 순위는 3위 → 1위가 개선이다. 그대로 빼면 음수가 되므로 뒤집는다.
  const posDelta = curPos !== null && prevPos !== null ? round1(prevPos - curPos) : null;

  // 랭킹에는 우리 병원도 같은 척도로 합류해 있다. 경쟁사 판도에서는 빼야
  // "이 병원들이 우리 자리를 가져갔다" 목록에 우리가 끼는 일이 없다.
  const rateOf = (scan: SavedScan) =>
    new Map(
      (scan.competitorRankings ?? [])
        .filter(c => !c.isTarget)
        .map(c => [c.name, c.exposureRate]),
    );
  const curRates = rateOf(current);
  const prevRates = rateOf(previous);

  const moves: CompetitorMove[] = [];
  for (const [name, currentRate] of curRates) {
    const previousRate = prevRates.get(name) ?? 0;
    const delta = round1(currentRate - previousRate);
    if (delta !== 0) moves.push({ name, currentRate, previousRate, delta });
  }
  for (const [name, previousRate] of prevRates) {
    if (curRates.has(name)) continue;
    moves.push({ name, currentRate: 0, previousRate, delta: round1(-previousRate) });
  }

  const domainsOf = (scan: SavedScan) => new Set((scan.citations ?? []).map(c => c.domain));
  const curDomains = domainsOf(current);
  const prevDomains = domainsOf(previous);

  const weakOf = (scan: SavedScan) => new Set((scan.weakKeywords ?? []).map(w => w.keyword));
  const curWeak = weakOf(current);
  const prevWeak = weakOf(previous);

  return {
    currentDate: current.scanDate,
    previousDate: previous.scanDate,
    spanDays: Math.max(
      0,
      Math.round(
        (new Date(current.scanDate).getTime() - new Date(previous.scanDate).getTime()) / 86_400_000,
      ),
    ),
    sov: { current: curSov, previous: prevSov, delta: round1(curSov - prevSov) },
    position: { current: curPos, previous: prevPos, delta: posDelta },
    risingCompetitors: moves.filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5),
    fallingCompetitors: moves.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5),
    newCitations: [...curDomains].filter(d => !prevDomains.has(d)).slice(0, 10),
    lostCitations: [...prevDomains].filter(d => !curDomains.has(d)).slice(0, 10),
    fixedKeywords: [...prevWeak].filter(k => !curWeak.has(k)).slice(0, 10),
    newWeakKeywords: [...curWeak].filter(k => !prevWeak.has(k)).slice(0, 10),
  };
}
