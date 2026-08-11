import type { V3AnalysisResult, SavedScan, ClinicRecord, ScanTexts, HistoryRecord } from '@/types/v3';

/** 401이면 세션 만료 — 로그인으로 보낸다. middleware가 API에는 JSON 401을 준다. */
async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (res.status === 401 && typeof window !== 'undefined') {
    alert('세션이 만료되었습니다. 다시 로그인해 주세요.');
    window.location.href = '/login';
  }
  return res;
}

export async function saveClinicScan(result: V3AnalysisResult): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await api('/api/storage/clinics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    const json = await res.json();
    return json.success ? { ok: true } : { ok: false, error: json.error ?? '저장에 실패했습니다.' };
  } catch {
    return { ok: false, error: '서버와 통신할 수 없습니다.' };
  }
}

/**
 * 저장소 장애와 '저장된 게 없음'을 구분해서 돌려준다.
 * 둘을 합치면 KV가 죽었을 때 화면에 "0개 치과"만 떠서 원인을 알 수 없다.
 */
export async function getClinics(): Promise<{ clinics: ClinicRecord[]; error?: string }> {
  try {
    const res = await api('/api/storage/clinics');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { clinics: [], error: data.error ?? '저장소를 읽을 수 없습니다.' };
    }
    return { clinics: data.clinics ?? [] };
  } catch {
    return { clinics: [], error: '서버와 통신할 수 없습니다.' };
  }
}

/** 저장된 스캔의 응답 원문. 목록 조회를 가볍게 하려고 분리 저장돼 있다. */
export async function getScanTexts(scanId: string): Promise<ScanTexts | null> {
  try {
    const res = await api(`/api/storage/clinics?scanId=${encodeURIComponent(scanId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.texts ?? null;
  } catch {
    return null;
  }
}

export async function deleteScan(clinicName: string, scanId: string): Promise<void> {
  await api('/api/storage/clinics', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicName, scanId }),
  });
}

export async function deleteClinic(clinicName: string): Promise<void> {
  await api('/api/storage/clinics', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicName }),
  });
}

/** 저장된 스캔을 대시보드가 읽는 형태로 복원. 원문은 texts에서 채운다. */
export function savedScanToResult(scan: SavedScan, texts: ScanTexts | null): V3AnalysisResult {
  const byId = new Map((texts?.byPrompt ?? []).map(t => [t.promptId, t]));
  return {
    input: scan.input,
    settings: scan.settings,
    scanDate: scan.scanDate,
    schemaVersion: 2,
    promptResults: scan.promptResults.map(r => {
      const t = byId.get(r.prompt.id);
      return {
        prompt: r.prompt,
        chatgpt: {
          ...r.chatgpt,
          responseTexts: t?.chatgpt ?? [],
          oks: t?.chatgptOks ?? [],
        },
        gemini: {
          ...r.gemini,
          responseTexts: t?.gemini ?? [],
          oks: t?.geminiOks ?? [],
        },
      };
    }),
    summary: scan.summary,
    competitorRankings: scan.competitorRankings,
    weakKeywords: scan.weakKeywords ?? [],
  };
}

/**
 * 추이는 저장된 스캔에서 파생한다. 별도 저장하지 않는다.
 * 예전엔 localStorage에 따로 쌓아서 기기를 바꾸면 사라지고,
 * 저장 스캔을 '보기'만 해도 레코드가 중복 추가되는 문제가 있었다.
 */
export function historyFromClinic(clinic: ClinicRecord): HistoryRecord[] {
  return [...clinic.scans]
    .sort((a, b) => new Date(a.scanDate).getTime() - new Date(b.scanDate).getTime())
    .slice(-30)
    .map(s => ({
      scanDate: s.scanDate,
      clinicFullName: s.input.clinicFullName,
      clinicShortName: s.input.clinicShortName,
      chatgptSov: s.summary.chatgpt.sov,
      geminiSov: s.summary.gemini.sov,
      overallSov: s.summary.overall.sov,
    }));
}
