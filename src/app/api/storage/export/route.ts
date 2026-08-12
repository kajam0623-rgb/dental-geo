import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import type { ClinicRecord, ScanTexts } from '@/types/v3';

/**
 * 저장된 전체 데이터를 JSON 한 파일로 내보낸다.
 * 저장소가 또 사라져도(무료 티어 아카이브 등) 대행사 쪽에 원본이 남게 하는 안전망이다.
 * 응답 원문까지 포함하므로 그대로 복원 가능한 형태다.
 */
export const maxDuration = 60;

const INDEX_KEY = 'geo:index';
const textsKey = (scanId: string) => `geo:texts:${scanId}`;

export interface ExportBundle {
  exportedAt: string;
  schemaVersion: 2;
  clinicCount: number;
  scanCount: number;
  clinics: ClinicRecord[];
  /** scanId → 응답 원문 */
  texts: Record<string, ScanTexts>;
}

export async function GET() {
  try {
    const index = (await kv.smembers(INDEX_KEY)) ?? [];
    const records = await Promise.all(index.map(k => kv.get<ClinicRecord>(k)));
    const clinics = records.filter((c): c is ClinicRecord => c !== null && Array.isArray(c.scans));

    const scanIds = clinics.flatMap(c => c.scans.map(s => s.id));
    const textEntries = await Promise.all(
      scanIds.map(async id => [id, await kv.get<ScanTexts>(textsKey(id))] as const),
    );
    const texts = Object.fromEntries(
      textEntries.filter((e): e is readonly [string, ScanTexts] => e[1] !== null),
    );

    const bundle: ExportBundle = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 2,
      clinicCount: clinics.length,
      scanCount: scanIds.length,
      clinics,
      texts,
    };

    const stamp = bundle.exportedAt.slice(0, 10);
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="dental-geo-backup-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('export error:', e);
    return NextResponse.json(
      { success: false, error: '내보내기에 실패했습니다. 저장소 상태를 확인하세요.' },
      { status: 500 },
    );
  }
}
