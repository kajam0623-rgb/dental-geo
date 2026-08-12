import type { CompetitorRank, WeakKeyword } from './ranking';

export type { CompetitorRank, WeakKeyword };

export type PromptCategory = '지역형' | '증상형' | '비교형' | '추천형';

export interface PromptItem {
  id: string;
  text: string;        // full text sent to AI (includes suffix)
  displayText: string; // clean text shown in UI (no suffix)
  category: PromptCategory;
}

export interface V3SearchInput {
  clinicFullName: string;
  clinicShortName: string;
  treatments: string[];
  regions: string[];
}

export interface ScanSettings {
  chatgptCount: 3 | 5 | 10;
  geminiCount: 3 | 5 | 10;
}

/**
 * answered = 실제로 응답을 받은 건수. sov의 분모는 total이 아니라 answered다.
 * failed(오류·타임아웃)를 '노출 안 됨'으로 세면 API 장애 시 허위 0% 리포트가 나간다.
 */
export interface EngineSummary {
  total: number;
  answered: number;
  failed: number;
  mentions: number;
  sov: number;
}

export interface EngineScanResult extends EngineSummary {
  responseTexts: string[];
  positions: Array<number | null>;
  oks: boolean[];
}

/**
 * AI가 답변을 만들 때 실제로 참고한 출처.
 * "어디에 콘텐츠를 깔아야 AI가 우리를 말하는가"에 직접 답하는 지표다.
 */
export interface CitationSource {
  domain: string;
  /** 인용된 횟수 */
  count: number;
  /** 응답 대비 인용률 */
  rate: number;
}

export interface PromptScanResult {
  prompt: PromptItem;
  chatgpt: EngineScanResult;
  gemini: EngineScanResult;
}

export interface V3Summary {
  chatgpt: EngineSummary;
  gemini: EngineSummary;
  overall: { sov: number };
  totalAnswered: number;
  totalFailed: number;
  /** 양쪽 엔진 모두에서 노출된 프롬프트 비율 (구 agreementRate 대체) */
  bothVisibleRate: number;
  /** AI 추천 목록에서 우리 병원의 평균 순위. 미노출이면 null */
  avgPosition: number | null;
}

export interface V3AnalysisResult {
  input: V3SearchInput;
  settings: ScanSettings;
  scanDate: string;
  schemaVersion: 2;
  promptResults: PromptScanResult[];
  summary: V3Summary;
  competitorRankings: CompetitorRank[];
  weakKeywords: WeakKeyword[];
  /** AI가 참고한 출처 도메인 (많이 인용된 순) */
  citations: CitationSource[];
  /** 우리 프롬프트를 받은 AI가 실제로 돌린 검색어 */
  searchQueries: string[];
}

/** KV에 보관하는 스캔 요약. 응답 원문은 geo:texts:<id>에 따로 저장한다. */
export interface SavedScan {
  id: string;
  scanDate: string;
  schemaVersion: 2;
  input: V3SearchInput;
  settings: ScanSettings;
  promptResults: Array<{
    prompt: PromptItem;
    chatgpt: EngineSummary & { positions: Array<number | null> };
    gemini: EngineSummary & { positions: Array<number | null> };
  }>;
  summary: V3Summary;
  competitorRankings: CompetitorRank[];
  weakKeywords: WeakKeyword[];
  citations: CitationSource[];
  searchQueries: string[];
}

/** 프롬프트별·엔진별 응답 원문. 스캔 1건당 1레코드. */
export interface ScanTexts {
  scanId: string;
  byPrompt: Array<{
    promptId: string;
    chatgpt: string[];
    gemini: string[];
    chatgptOks: boolean[];
    geminiOks: boolean[];
  }>;
}

export interface ClinicRecord {
  clinicFullName: string;
  clinicShortName: string;
  scans: SavedScan[];
  lastUpdated: string;
  schemaVersion: 2;
}

export interface HistoryRecord {
  scanDate: string;
  clinicFullName: string;
  clinicShortName: string;
  chatgptSov: number;
  geminiSov: number;
  overallSov: number;
}
