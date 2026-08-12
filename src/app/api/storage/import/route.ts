import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { canonicalKey } from '@/utils/ranking';
import type { ClinicRecord, SavedScan, ScanTexts } from '@/types/v3';

/**
 * 백업 JSON을 되돌려 넣는다. 저장소가 사라졌을 때 export 파일로 복구하는 용도다.
 * 내보내기만 있고 복원이 없으면 안전망이 반쪽이라 짝으로 둔다.
 *
 * 기본은 병합(merge): 같은 치과가 있으면 스캔을 합치고 id로 중복을 걸러낸다.
 * 덮어쓰기는 명시적으로 mode=replace를 줘야 한다.
 */
export const maxDuration = 60;

const INDEX_KEY = 'geo:index';
const clinicKey = (name: string) => `geo:clinic:${canonicalKey(name)}`;
const textsKey = (scanId: string) => `geo:texts:${scanId}`;
const MAX_SCANS = 50;

interface ImportBody {
  clinics?: ClinicRecord[];
  texts?: Record<string, ScanTexts>;
  mode?: 'merge' | 'replace';
}

function validate(body: ImportBody): string | null {
  if (!Array.isArray(body.clinics)) return '백업 파일 형식이 올바르지 않습니다 (clinics 없음).';
  if (body.clinics.length > 500) return '치과가 너무 많습니다 (최대 500).';
  for (const c of body.clinics) {
    if (typeof c?.clinicFullName !== 'string' || !c.clinicFullName.trim()) {
      return '치과명이 없는 항목이 있습니다.';
    }
    if (!Array.isArray(c.scans)) return `${c.clinicFullName}: scans 형식이 올바르지 않습니다.`;
  }
  return null;
}

export async function POST(request: Request) {
  let body: ImportBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON을 해석할 수 없습니다.' }, { status: 400 });
  }

  const invalid = validate(body);
  if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 400 });

  const replace = body.mode === 'replace';

  try {
    let clinicsWritten = 0;
    let scansAdded = 0;
    let scansSkipped = 0;

    for (const incoming of body.clinics!) {
      const key = clinicKey(incoming.clinicFullName);
      const existing = replace ? null : await kv.get<ClinicRecord>(key);

      let scans: SavedScan[];
      if (existing) {
        const seen = new Set(existing.scans.map(s => s.id));
        const fresh = incoming.scans.filter(s => {
          if (seen.has(s.id)) { scansSkipped++; return false; }
          return true;
        });
        scansAdded += fresh.length;
        scans = [...existing.scans, ...fresh]
          .sort((a, b) => new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime())
          .slice(0, MAX_SCANS);
      } else {
        scansAdded += incoming.scans.length;
        scans = [...incoming.scans]
          .sort((a, b) => new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime())
          .slice(0, MAX_SCANS);
      }

      const record: ClinicRecord = {
        clinicFullName: incoming.clinicFullName,
        clinicShortName: incoming.clinicShortName ?? existing?.clinicShortName ?? '',
        scans,
        lastUpdated: scans[0]?.scanDate ?? new Date().toISOString(),
        schemaVersion: 2,
      };

      await kv.set(key, record);
      await kv.sadd(INDEX_KEY, key);
      clinicsWritten++;
    }

    // 응답 원문도 함께 복원한다. 없으면 저장된 스캔에 근거가 비게 된다.
    let textsWritten = 0;
    for (const [scanId, texts] of Object.entries(body.texts ?? {})) {
      if (!texts?.byPrompt) continue;
      await kv.set(textsKey(scanId), texts);
      textsWritten++;
    }

    console.log(`[import] 치과 ${clinicsWritten} · 스캔 +${scansAdded}(중복 ${scansSkipped}) · 원문 ${textsWritten}`);
    return NextResponse.json({
      success: true,
      mode: replace ? 'replace' : 'merge',
      clinicsWritten,
      scansAdded,
      scansSkipped,
      textsWritten,
    });
  } catch (e) {
    console.error('import error:', e);
    return NextResponse.json(
      { success: false, error: '복원에 실패했습니다. 저장소 상태를 확인하세요.' },
      { status: 500 },
    );
  }
}
