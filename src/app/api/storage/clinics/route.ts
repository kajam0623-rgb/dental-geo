import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import type { ClinicRecord, SavedScan, V3AnalysisResult } from '@/types/v3';

const KV_KEY = 'geo-clinics-v2';

async function loadAll(): Promise<Record<string, ClinicRecord>> {
  try {
    return (await kv.get<Record<string, ClinicRecord>>(KV_KEY)) ?? {};
  } catch {
    return {};
  }
}

async function persist(data: Record<string, ClinicRecord>) {
  await kv.set(KV_KEY, data);
}

export async function GET() {
  const all = await loadAll();
  const clinics = Object.values(all).sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );
  return NextResponse.json({ clinics });
}

export async function POST(request: Request) {
  try {
    const result: V3AnalysisResult = await request.json();
    const all = await loadAll();
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

    await persist(all);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('storage POST error:', e);
    return NextResponse.json({ success: false, error: 'KV not configured' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { clinicName, scanId }: { clinicName: string; scanId?: string } = await request.json();
    const all = await loadAll();

    if (!all[clinicName]) return NextResponse.json({ success: true });

    if (scanId) {
      all[clinicName].scans = all[clinicName].scans.filter((s: SavedScan) => s.id !== scanId);
      if (all[clinicName].scans.length === 0) {
        delete all[clinicName];
      } else {
        all[clinicName].lastUpdated = all[clinicName].scans[0].scanDate;
      }
    } else {
      delete all[clinicName];
    }

    await persist(all);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('storage DELETE error:', e);
    return NextResponse.json({ success: false, error: 'KV not configured' }, { status: 500 });
  }
}
