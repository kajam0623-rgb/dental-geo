import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { canonicalKey } from '@/utils/ranking';
import { runAnalysisV3 } from '@/utils/analyze';
import type { ClinicRecord, SavedScan, ScanTexts, V3AnalysisResult } from '@/types/v3';

/**
 * 월 1회 저장된 치과를 자동 재스캔한다.
 * 대행사가 매달 원장에게 "지난달 대비 이렇게 달라졌다"를 보여주려면
 * 같은 조건의 스캔이 매달 쌓여 있어야 한다. 사람이 기억해서 누르면 빠진다.
 *
 * 직전 스캔의 프롬프트·횟수를 그대로 재사용한다. 조건이 바뀌면 비교가 무의미해진다.
 */
export const maxDuration = 300;

const INDEX_KEY = 'geo:index';
const clinicKey = (name: string) => `geo:clinic:${canonicalKey(name)}`;
const textsKey = (scanId: string) => `geo:texts:${scanId}`;
const MAX_SCANS = 50;

/** 함수 제한(300초) 안에서 끝내기 위한 예산. 남는 치과는 다음 달로 넘긴다. */
const TIME_BUDGET_MS = 230_000;
/** 최근 이 기간 안에 스캔했으면 건너뛴다 (수동 스캔과 중복 방지) */
const SKIP_IF_SCANNED_WITHIN_DAYS = 20;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

async function persist(record: ClinicRecord, result: V3AnalysisResult): Promise<void> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
    citations: result.citations,
    searchQueries: result.searchQueries,
  };

  record.scans = [scan, ...record.scans].slice(0, MAX_SCANS);
  record.lastUpdated = result.scanDate;
  await kv.set(clinicKey(record.clinicFullName), record);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const scanned: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  let deferred = 0;

  try {
    const index = (await kv.smembers(INDEX_KEY)) ?? [];
    const records = await Promise.all(index.map(k => kv.get<ClinicRecord>(k)));
    // 오래 방치된 치과부터 처리한다 — 예산이 모자라도 가장 필요한 곳이 먼저 갱신된다
    const clinics = records
      .filter((c): c is ClinicRecord => c !== null && Array.isArray(c.scans) && c.scans.length > 0)
      .sort((a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime());

    for (const record of clinics) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) { deferred++; continue; }

      if (daysSince(record.lastUpdated) < SKIP_IF_SCANNED_WITHIN_DAYS) {
        skipped.push(record.clinicFullName);
        continue;
      }

      const last = record.scans[0];
      const prompts = last.promptResults.map(r => r.prompt);
      if (prompts.length === 0) { skipped.push(record.clinicFullName); continue; }

      try {
        const result = await runAnalysisV3(last.input, prompts, last.settings);
        await persist(record, result);
        scanned.push(record.clinicFullName);
      } catch (e) {
        console.error(`[monthly-scan] ${record.clinicFullName} 실패:`, e);
        failed.push(record.clinicFullName);
      }
    }

    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    console.log(`[monthly-scan] ${elapsedSec}초 · 갱신 ${scanned.length} · 건너뜀 ${skipped.length} · 실패 ${failed.length} · 이월 ${deferred}`);
    return NextResponse.json({ success: true, elapsedSec, scanned, skipped, failed, deferred });
  } catch (e) {
    console.error('[monthly-scan] error:', e);
    return NextResponse.json(
      { success: false, error: '월간 재스캔에 실패했습니다.', scanned, failed },
      { status: 500 },
    );
  }
}
