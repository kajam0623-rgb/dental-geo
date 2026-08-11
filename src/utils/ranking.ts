// AI 응답 원문에서 치과 이름과 노출 순서를 뽑아내는 순수 함수 모음.
// 외부 API를 타지 않으므로 단위 테스트로 전부 검증한다.

import type { CompetitorRank, KeywordDetail, WeakKeyword } from '@/types/ranking';

export function normalizeText(text: string): string {
  return text.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase();
}

// '서울바른치과의원'으로 등록해도 AI가 '서울바른치과'로 답하는 경우를 잡기 위한 변형 목록
export function nameVariants(clinicName: string): string[] {
  const base = normalizeText(clinicName);
  if (base.length < 2) return [];
  const variants = new Set([base]);
  const stripped = base.replace(/(의원|병원)$/, '');
  if (stripped.length >= 2) variants.add(stripped);
  return [...variants];
}

// AI가 같은 치과를 '강남레옹치과'와 '강남레옹치과의원'으로 번갈아 부른다.
// 집계 키를 통일하지 않으면 한 치과가 둘로 쪼개져 랭킹이 왜곡된다.
export function canonicalKey(clinicName: string): string {
  return normalizeText(clinicName).replace(/(의원|병원)$/, '');
}

export function isMentioned(text: string, clinicName: string): boolean {
  const variants = nameVariants(clinicName);
  if (variants.length === 0) return false;
  const normalizedText = normalizeText(text);
  return variants.some((v) => normalizedText.includes(v));
}

// 긴 접미사를 먼저 매치해야 '치과의원'이 '치과'로 잘리지 않는다
const CLINIC_NAME_RE = /[가-힣A-Za-z0-9]{2,14}(?:치과의원|치과병원|치과|덴탈센터|덴탈|클리닉|의원|병원)/g;
const LIST_MARKER_RE = /^\s*(?:\d+\s*[.)]|[-•*·])\s*/;

// AI가 추천한 순서 그대로 치과 이름을 뽑는다. 목록의 순서가 곧 AI가 매긴 순위다.
export function extractRankedClinics(text: string): string[] {
  const lines = text.split('\n');
  const listLines = lines.filter((l) => LIST_MARKER_RE.test(l));
  // 목록 형태면 각 항목의 첫 이름만 취한다 (설명 문장에 섞인 단어를 걸러내기 위함)
  const sources = listLines.length > 0
    ? listLines.map((l) => l.replace(LIST_MARKER_RE, ''))
    : [text];

  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    const cleaned = source.replace(/\*\*/g, '').replace(/\*/g, '');
    const matches = cleaned.match(CLINIC_NAME_RE) ?? [];
    // 목록 항목은 첫 이름만, 통짜 텍스트는 등장 순서대로 전부
    const picked = listLines.length > 0 ? matches.slice(0, 1) : matches;
    for (const name of picked) {
      const key = normalizeText(name);
      if (key.length < 3 || seen.has(key)) continue;
      seen.add(key);
      ordered.push(name);
    }
  }

  return ordered;
}

// 우리 치과가 몇 번째로 불렸는지. 없으면 null.
export function findPosition(text: string, clinicName: string): number | null {
  const variants = nameVariants(clinicName);
  if (variants.length === 0) return null;
  const ranked = extractRankedClinics(text);
  const index = ranked.findIndex((name) => {
    const n = normalizeText(name);
    return variants.some((v) => n.includes(v) || v.includes(n));
  });
  return index === -1 ? null : index + 1;
}

/**
 * 여러 응답을 가로질러 경쟁 치과를 집계한다.
 * 우리 치과는 제외하고, 많이 등장한 순 → 평균 순위가 앞선 순으로 정렬.
 */
export function rankCompetitors(
  texts: string[],
  clinicName: string,
  answeredCount: number,
): CompetitorRank[] {
  const variants = nameVariants(clinicName);
  const stats = new Map<string, { name: string; mentions: number; positions: number[] }>();

  for (const text of texts) {
    const ranked = extractRankedClinics(text);
    ranked.forEach((name, i) => {
      const key = canonicalKey(name);
      // 우리 치과는 경쟁사 목록에서 뺀다
      if (variants.some((v) => key.includes(v) || v.includes(key))) return;
      const entry = stats.get(key) ?? { name, mentions: 0, positions: [] };
      // 가장 완전한 표기를 대표 이름으로 남긴다 ('강남레옹치과' < '강남레옹치과의원')
      if (name.length > entry.name.length) entry.name = name;
      entry.mentions += 1;
      entry.positions.push(i + 1);
      stats.set(key, entry);
    });
  }

  return [...stats.values()]
    .map((e) => ({
      name: e.name,
      mentions: e.mentions,
      exposureRate: answeredCount > 0 ? Number(((e.mentions / answeredCount) * 100).toFixed(1)) : 0,
      avgPosition: Number((e.positions.reduce((a, b) => a + b, 0) / e.positions.length).toFixed(1)),
    }))
    .sort((a, b) => b.mentions - a.mentions || a.avgPosition - b.avgPosition);
}

export function averagePosition(positions: Array<number | null>): number | null {
  const hits = positions.filter((p): p is number => p !== null);
  if (hits.length === 0) return null;
  return Number((hits.reduce((a, b) => a + b, 0) / hits.length).toFixed(1));
}

// 4위 밖이면 환자 눈에 사실상 안 들어온다고 본다
const WEAK_POSITION_THRESHOLD = 4;

// 우리가 밀린 키워드와 그 자리를 차지한 치과를 뽑는다 — 콘텐츠 집행 소재가 된다
export function findWeakKeywords(details: KeywordDetail[], clinicName: string): WeakKeyword[] {
  const weak: WeakKeyword[] = [];

  for (const d of details) {
    // 양쪽 다 응답을 못 받았으면 판단 근거가 없으므로 건너뛴다
    if (!d.chatgptOk && !d.geminiOk) continue;

    const positions = [d.chatgptPosition, d.geminiPosition].filter((p): p is number => p !== null);
    const bestPosition = positions.length > 0 ? Math.min(...positions) : null;

    if (bestPosition !== null && bestPosition < WEAK_POSITION_THRESHOLD) continue;

    const texts = [
      ...(d.chatgptOk ? [d.chatgptResponseText] : []),
      ...(d.geminiOk ? [d.geminiResponseText] : []),
    ];
    // 우리보다 앞선 치과만 (미노출이면 상위 3곳)
    const cutoff = bestPosition === null ? 3 : bestPosition - 1;
    const ahead = texts
      .flatMap((t) => extractRankedClinics(t).slice(0, cutoff))
      .filter((name) => !isMentioned(name, clinicName));

    weak.push({
      keyword: d.keyword,
      reason: bestPosition === null ? 'absent' : 'low',
      bestPosition,
      topCompetitors: [...new Set(ahead)].slice(0, 3),
    });
  }

  return weak;
}
