import type { V3AnalysisResult, SavedScan, ClinicRecord } from '@/types/v3';

export async function saveClinicScan(result: V3AnalysisResult): Promise<void> {
  await fetch('/api/storage/clinics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  });
}

export async function getClinics(): Promise<ClinicRecord[]> {
  try {
    const res = await fetch('/api/storage/clinics');
    if (!res.ok) return [];
    const data = await res.json();
    return data.clinics ?? [];
  } catch {
    return [];
  }
}

export async function deleteScan(clinicName: string, scanId: string): Promise<void> {
  await fetch('/api/storage/clinics', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicName, scanId }),
  });
}

export async function deleteClinic(clinicName: string): Promise<void> {
  await fetch('/api/storage/clinics', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicName }),
  });
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
