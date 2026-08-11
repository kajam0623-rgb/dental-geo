import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { AUTH_COOKIE, COOKIE_MAX_AGE, issueToken, passwordMatches } from '@/utils/authToken';

export const runtime = 'nodejs';

const RATE_LIMIT = 5;      // 분당 시도 횟수
const RATE_WINDOW = 60;    // 초

async function tooManyAttempts(ip: string): Promise<boolean> {
  try {
    const key = `geo:authtry:${ip}`;
    const n = await kv.incr(key);
    if (n === 1) await kv.expire(key, RATE_WINDOW);
    return n > RATE_LIMIT;
  } catch {
    return false; // KV 장애가 로그인 자체를 막지는 않게 한다
  }
}

export async function POST(request: Request) {
  const correct = process.env.ACCESS_PASSWORD;
  if (!correct) {
    return NextResponse.json({ success: false, error: '서버에 비밀번호가 설정되지 않았습니다.' }, { status: 500 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (await tooManyAttempts(ip)) {
    return NextResponse.json({ success: false, error: '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429 });
  }

  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  if (!passwordMatches(password, correct)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(AUTH_COOKIE, issueToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}
