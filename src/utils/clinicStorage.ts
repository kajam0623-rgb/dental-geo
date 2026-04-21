import type { V3AnalysisResult, SavedScan, ClinicRecord } from '@/types/v3';

const KEY = 'geo-clinics-v2';

function loadAll(): Record<string, ClinicRecord> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

function persist(data: Record<string, ClinicRecord>) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function saveClinicScan(result: V3AnalysisResult): void {
  const all = loadAll();
  const key = result.input.clinicFullName;

  const scan: SavedScan = {
    id: Date.now().toString(),
    scanDate: result.scanDate,
    input: result.input,
    settings: result.settings,
    promptResults: result.promptResults.map(r => ({
      prompt: r.prompt,
      chatgpt: { mentioned: r.chatgpt.mentioned, total: r.chatgpt.total },
      gemini: { mentioned: r.gemini.mentioned, total: r.gemini.total },
    })),
    summary: result.summary,
    competitorRankings: result.competitorRankings,
  };

  if (!all[key]) {
    all[key] = {
      clinicFullName: result.input.clinicFullName,
      clinicShortName: result.input.clinicShortName,
      scans: [],
      lastUpdated: result.scanDate,
    };
  }

  all[key].scans.unshift(scan);
  all[key].scans = all[key].scans.slice(0, 50);
  all[key].lastUpdated = result.scanDate;

  persist(all);
}

export function getClinics(): ClinicRecord[] {
  return Object.values(loadAll()).sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );
}

export function deleteScan(clinicName: string, scanId: string): void {
  const all = loadAll();
  if (!all[clinicName]) return;
  all[clinicName].scans = all[clinicName].scans.filter(s => s.id !== scanId);
  if (all[clinicName].scans.length === 0) {
    delete all[clinicName];
  } else {
    all[clinicName].lastUpdated = all[clinicName].scans[0].scanDate;
  }
  persist(all);
}

export function deleteClinic(clinicName: string): void {
  const all = loadAll();
  delete all[clinicName];
  persist(all);
}

export function savedScanToResult(scan: SavedScan): V3AnalysisResult {
  return {
    input: scan.input,
    settings: scan.settings,
    scanDate: scan.scanDate,
    promptResults: scan.promptResults.map(r => ({
      prompt: r.prompt,
      chatgpt: { ...r.chatgpt, responseTexts: [] },
      gemini: { ...r.gemini, responseTexts: [] },
    })),
    summary: scan.summary,
    competitorRankings: scan.competitorRankings,
  };
}
