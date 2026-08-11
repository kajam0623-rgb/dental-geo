import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

/**
 * KV 활성 유지용. Upstash 무료 티어는 30일 이상 미사용이면 DB를 아카이브해서
 * 저장 기능이 통째로 죽는다(2026-04 → 2026-08 사이 실제로 그렇게 사라졌다).
 * Vercel Cron이 하루 한 번 호출해 읽기·쓰기를 한 번씩 발생시킨다.
 *
 * Vercel Cron은 Authorization: Bearer ${CRON_SECRET} 헤더를 붙여 호출한다.
 * CRON_SECRET은 Vercel이 자동으로 프로젝트 환경변수에 넣어준다.
 */
export const maxDuration = 30;

const HEARTBEAT_KEY = 'geo:keepalive';

interface Heartbeat {
  lastPingAt: string;
  count: number;
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // 로컬 개발처럼 시크릿이 없으면 통과시킨다 (Vercel에서는 항상 설정된다)
  if (!secret) return true;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const prev = await kv.get<Heartbeat>(HEARTBEAT_KEY);
    const next: Heartbeat = {
      lastPingAt: new Date().toISOString(),
      count: (prev?.count ?? 0) + 1,
    };
    await kv.set(HEARTBEAT_KEY, next);

    console.log(`[keepalive] ping #${next.count} at ${next.lastPingAt}`);
    return NextResponse.json({ success: true, ...next, previousPingAt: prev?.lastPingAt ?? null });
  } catch (e) {
    // 실패하면 저장소가 이미 죽은 것이다 — 로그로 남겨 조기에 알아챈다
    console.error('[keepalive] KV 접근 실패 — 저장소가 죽었을 수 있다:', e);
    return NextResponse.json(
      { success: false, error: 'KV 접근에 실패했습니다. 저장소 상태를 확인하세요.' },
      { status: 500 },
    );
  }
}
