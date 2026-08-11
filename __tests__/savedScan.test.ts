import { describe, it, expect } from 'vitest';
import { savedScanToResult, historyFromClinic } from '@/utils/clinicStorage';
import type { SavedScan, ScanTexts, ClinicRecord, V3Summary, PromptItem } from '@/types/v3';

const prompt: PromptItem = { id: 'p1', text: '강남역 임플란트 추천 이름만.', displayText: '강남역 임플란트 추천', category: '지역형' };

const summary: V3Summary = {
  chatgpt: { total: 3, answered: 0, failed: 3, mentions: 0, sov: 0 },
  gemini: { total: 3, answered: 3, failed: 0, mentions: 3, sov: 100 },
  overall: { sov: 100 },
  totalAnswered: 3,
  totalFailed: 3,
  bothVisibleRate: 0,
  avgPosition: 1.3,
};

const scan: SavedScan = {
  id: 'scan-1',
  scanDate: '2026-08-11T00:00:00.000Z',
  schemaVersion: 2,
  input: { clinicFullName: '하루플란트치과의원', clinicShortName: '', treatments: ['임플란트'], regions: ['강남역'] },
  settings: { chatgptCount: 3, geminiCount: 3 },
  promptResults: [{
    prompt,
    chatgpt: { total: 3, answered: 0, failed: 3, mentions: 0, sov: 0, positions: [null, null, null] },
    gemini: { total: 3, answered: 3, failed: 0, mentions: 3, sov: 100, positions: [1, 1, 2] },
  }],
  summary,
  competitorRankings: [],
  weakKeywords: [],
};

const texts: ScanTexts = {
  scanId: 'scan-1',
  byPrompt: [{
    promptId: 'p1',
    chatgpt: ['[오류] no credits', '[오류] no credits', '[오류] no credits'],
    gemini: ['1. 하루플란트치과', '1. 하루플란트치과', '2. 하루플란트치과'],
    chatgptOks: [false, false, false],
    geminiOks: [true, true, true],
  }],
};

describe('savedScanToResult — 저장된 스캔 복원', () => {
  it('응답 원문을 복원한다 (예전엔 빈 배열로 버려졌다)', () => {
    const r = savedScanToResult(scan, texts);
    expect(r.promptResults[0].gemini.responseTexts).toHaveLength(3);
    expect(r.promptResults[0].gemini.responseTexts[0]).toContain('하루플란트치과');
  });

  it('응답 성공/실패 플래그도 함께 복원한다', () => {
    const r = savedScanToResult(scan, texts);
    expect(r.promptResults[0].chatgpt.oks).toEqual([false, false, false]);
    expect(r.promptResults[0].gemini.oks).toEqual([true, true, true]);
  });

  it('순위 정보를 보존한다', () => {
    const r = savedScanToResult(scan, texts);
    expect(r.promptResults[0].gemini.positions).toEqual([1, 1, 2]);
    expect(r.summary.avgPosition).toBe(1.3);
  });

  it('원문 레코드가 없어도 요약은 복원된다', () => {
    const r = savedScanToResult(scan, null);
    expect(r.promptResults[0].gemini.responseTexts).toEqual([]);
    expect(r.summary.gemini.sov).toBe(100);
  });

  it('실패 건수가 요약에 살아 있다 (0%로 둔갑하지 않는다)', () => {
    const r = savedScanToResult(scan, texts);
    expect(r.summary.totalFailed).toBe(3);
    expect(r.summary.chatgpt.answered).toBe(0);
  });
});

describe('historyFromClinic — 추이는 저장 스캔에서 파생', () => {
  const clinic: ClinicRecord = {
    clinicFullName: '하루플란트치과의원',
    clinicShortName: '',
    schemaVersion: 2,
    lastUpdated: '2026-08-11T00:00:00.000Z',
    scans: [
      { ...scan, id: 's3', scanDate: '2026-08-11T00:00:00.000Z' },
      { ...scan, id: 's2', scanDate: '2026-08-05T00:00:00.000Z' },
      { ...scan, id: 's1', scanDate: '2026-08-01T00:00:00.000Z' },
    ],
  };

  it('오래된 순으로 정렬해 반환한다', () => {
    const h = historyFromClinic(clinic);
    expect(h.map(r => r.scanDate)).toEqual([
      '2026-08-01T00:00:00.000Z',
      '2026-08-05T00:00:00.000Z',
      '2026-08-11T00:00:00.000Z',
    ]);
  });

  it('여러 번 호출해도 레코드가 늘지 않는다 (열람 시 중복 누적 버그)', () => {
    const a = historyFromClinic(clinic);
    const b = historyFromClinic(clinic);
    const c = historyFromClinic(clinic);
    expect(a).toHaveLength(3);
    expect(b).toHaveLength(3);
    expect(c).toHaveLength(3);
  });
});
