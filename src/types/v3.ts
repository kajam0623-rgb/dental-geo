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
  chatgptCount: 3 | 5 | 10 | 20;
  geminiCount: 3 | 5 | 10 | 20;
}

export interface PromptScanResult {
  prompt: PromptItem;
  chatgpt: {
    mentioned: number;
    total: number;
    responseTexts: string[];
  };
  gemini: {
    mentioned: number;
    total: number;
    responseTexts: string[];
  };
}

export interface CompetitorRank {
  name: string;
  count: number;
  percentage: number;
  isTarget?: boolean;
}

export interface V3AnalysisResult {
  input: V3SearchInput;
  settings: ScanSettings;
  scanDate: string;
  promptResults: PromptScanResult[];
  summary: {
    chatgpt: { sov: number; mentions: number; total: number };
    gemini: { sov: number; mentions: number; total: number };
    overall: { sov: number };
    agreementRate: number;
  };
  competitorRankings: CompetitorRank[];
}

export interface SavedScan {
  id: string;
  scanDate: string;
  input: V3SearchInput;
  settings: ScanSettings;
  promptResults: Array<{
    prompt: PromptItem;
    chatgpt: { mentioned: number; total: number };
    gemini: { mentioned: number; total: number };
  }>;
  summary: {
    chatgpt: { sov: number; mentions: number; total: number };
    gemini: { sov: number; mentions: number; total: number };
    overall: { sov: number };
    agreementRate: number;
  };
  competitorRankings: CompetitorRank[];
}

export interface ClinicRecord {
  clinicFullName: string;
  clinicShortName: string;
  scans: SavedScan[];
  lastUpdated: string;
}

export interface HistoryRecord {
  scanDate: string;
  clinicFullName: string;
  clinicShortName: string;
  chatgptSov: number;
  geminiSov: number;
  overallSov: number;
}
