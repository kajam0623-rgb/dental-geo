import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { canonicalKey } from '@/utils/ranking';
import type { ClinicRecord, SavedScan, ScanTexts, V3AnalysisResult } from '@/types/v3';

// 치과별 키로 분리한다. 예전처럼 전체를 한 키에 read-modify-write 하면
// 동시 저장 시 한쪽이 통째로 유실되고, 치과가 늘면 값 크기 한계에 걸린다.
const INDEX_KEY = 'geo:index';
const clinicKey = (name: string) => `geo:clinic:${canonicalKey(name)}`;
const textsKey = (scanId: string) => `geo:texts:${scanId}`;
const LEGACY_KEY = 'geo-clinics-v2';
const MAX_SCANS = 50;

// 인덱스는 Redis Set으로 다룬다. 배열을 read-modify-write 하면
// 서로 다른 치과를 동시에 저장할 때 인덱스가 덮여 한쪽이 목록에서 사라진다.
async function readIndex(): Promise<string[]> {
  return (await kv.smembers(INDEX_KEY)) ?? [];
}

async function addToIndex(key: string) {
  await kv.sadd(INDEX_KEY, key);
}

async function removeFromIndex(key: string) {
  await kv.srem(INDEX_KEY, key);
}

/** 구 스키마(전체가 한 키)를 치과별 키로 1회 이관한다. */
async function migrateLegacy(): Promise<void> {
  const legacy = await kv.get<Record<string, ClinicRecord>>(LEGACY_KEY);
  if (!legacy || Object.keys(legacy).length === 0) return;

  const keys: string[] = [];
  for (const record of Object.values(legacy)) {
    if (!record?.clinicFullName) continue;
    const key = clinicKey(record.clinicFullName);
    if (await kv.get(key)) continue; // 이미 이관됨
    await kv.set(key, { ...record, schemaVersion: 2 });
    keys.push(key);
  }
  if (keys.length > 0) await kv.sadd(INDEX_KEY, keys[0], ...keys.slice(1));
  await kv.del(LEGACY_KEY);
  console.log(`[migrate] legacy → v2: ${keys.length} clinics`);
}

export async function GET(request: Request) {
  try {
    await migrateLegacy();

    // 단건 조회: 저장된 스캔의 응답 원문
    const scanId = new URL(request.url).searchParams.get('scanId');
    if (scanId) {
      const texts = await kv.get<ScanTexts>(textsKey(scanId));
      return NextResponse.json({ success: true, texts: texts ?? null });
    }

    const idx = await readIndex();
    const records = await Promise.all(idx.map(k => kv.get<ClinicRecord>(k)));
    const clinics = records
      .filter((c): c is ClinicRecord => c !== null && Array.isArray(c.scans))
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

    return NextResponse.json({ success: true, clinics });
  } catch (e) {
    console.error('storage GET error:', e);
    return NextResponse.json({ success: false, error: '저장소를 읽을 수 없습니다.', clinics: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const result: V3AnalysisResult = await request.json();

    const name = result?.input?.clinicFullName;
    if (typeof name !== 'string' || !name.trim() || name.length > 100) {
      return NextResponse.json({ success: false, error: '치과명이 올바르지 않습니다.' }, { status: 400 });
    }
    if (!Array.isArray(result.promptResults) || result.promptResults.length === 0) {
      return NextResponse.json({ success: false, error: '저장할 스캔 결과가 없습니다.' }, { status: 400 });
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 응답 원문은 별도 키로. 목록 조회를 가볍게 유지하면서 근거를 보존한다.
    const texts: ScanTexts = {
      scanId: id,
      byPrompt: result.promptResults.map(r => ({
        promptId: r.prompt.id,
        chatgpt: r.chatgpt.responseTexts,
        gemini: r.gemini.responseTexts,
        chatgptOks: r.chatgpt.oks,
        geminiOks: r.gemini.oks,
      })),
    };
    await kv.set(textsKey(id), texts);

    const scan: SavedScan = {
      id,
      scanDate: result.scanDate,
      schemaVersion: 2,
      input: result.input,
      settings: result.settings,
      promptResults: result.promptResults.map(r => ({
        prompt: r.prompt,
        chatgpt: {
          total: r.chatgpt.total, answered: r.chatgpt.answered, failed: r.chatgpt.failed,
          mentions: r.chatgpt.mentions, sov: r.chatgpt.sov, positions: r.chatgpt.positions,
        },
        gemini: {
          total: r.gemini.total, answered: r.gemini.answered, failed: r.gemini.failed,
          mentions: r.gemini.mentions, sov: r.gemini.sov, positions: r.gemini.positions,
        },
      })),
      summary: result.summary,
      competitorRankings: result.competitorRankings,
      weakKeywords: result.weakKeywords,
    };

    const key = clinicKey(name);
    const existing = await kv.get<ClinicRecord>(key);
    const record: ClinicRecord = existing ?? {
      clinicFullName: name,
      clinicShortName: result.input.clinicShortName,
      scans: [],
      lastUpdated: result.scanDate,
      schemaVersion: 2,
    };

    record.scans = [scan, ...record.scans].slice(0, MAX_SCANS);
    record.lastUpdated = result.scanDate;
    record.clinicShortName = result.input.clinicShortName || record.clinicShortName;

    await kv.set(key, record);
    await addToIndex(key);

    return NextResponse.json({ success: true, scanId: id });
  } catch (e) {
    console.error('storage POST error:', e);
    return NextResponse.json({ success: false, error: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { clinicName, scanId }: { clinicName?: string; scanId?: string } = await request.json();
    if (typeof clinicName !== 'string' || !clinicName.trim()) {
      return NextResponse.json({ success: false, error: '치과명이 필요합니다.' }, { status: 400 });
    }

    const key = clinicKey(clinicName);
    const record = await kv.get<ClinicRecord>(key);
    if (!record) return NextResponse.json({ success: true });

    const removeTexts = async (ids: string[]) => {
      await Promise.all(ids.map(id => kv.del(textsKey(id))));
    };

    if (scanId) {
      const target = record.scans.find(s => s.id === scanId);
      record.scans = record.scans.filter(s => s.id !== scanId);
      if (target) await removeTexts([target.id]);

      if (record.scans.length === 0) {
        await kv.del(key);
        await removeFromIndex(key);
      } else {
        record.lastUpdated = record.scans[0].scanDate;
        await kv.set(key, record);
      }
    } else {
      await removeTexts(record.scans.map(s => s.id));
      await kv.del(key);
      await removeFromIndex(key);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('storage DELETE error:', e);
    return NextResponse.json({ success: false, error: '삭제에 실패했습니다.' }, { status: 500 });
  }
}
