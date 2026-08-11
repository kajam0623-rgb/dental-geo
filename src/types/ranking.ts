// 순위·경쟁사 분석 타입. ranking.ts(순수 함수)가 쓰는 최소 타입만 여기 둔다.

// 같은 질문에서 대신 추천된 치과들
export interface CompetitorRank {
  name: string;
  mentions: number;
  exposureRate: number;
  avgPosition: number;
  /** 우리 병원이면 true. 랭킹에 같은 척도로 합류시켜 표시한다. */
  isTarget?: boolean;
}

// 우리가 밀린 키워드 — 대행사가 바로 집행할 콘텐츠 소재가 된다
export interface WeakKeyword {
  keyword: string;
  reason: 'absent' | 'low';
  bestPosition: number | null;
  topCompetitors: string[];
}

// findWeakKeywords가 읽는 최소 형태. 프롬프트 1건에 대한 두 엔진의 결과.
export interface KeywordDetail {
  keyword: string;
  chatgptResponseText: string;
  geminiResponseText: string;
  // false면 응답을 못 받은 것(오류/타임아웃) — '노출 안 됨'과 다르다
  chatgptOk: boolean;
  geminiOk: boolean;
  // AI가 몇 번째로 불러줬는지. 노출 안 됐으면 null
  chatgptPosition: number | null;
  geminiPosition: number | null;
}
