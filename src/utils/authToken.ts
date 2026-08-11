import { createHmac, timingSafeEqual } from 'node:crypto';

export const AUTH_COOKIE = 'auth';
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30일

function secret(): string {
  // AUTH_SECRET이 없으면 비밀번호를 키로 쓴다 (설정 누락 시에도 원문 쿠키보다는 안전)
  return process.env.AUTH_SECRET || process.env.ACCESS_PASSWORD || '';
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

/** payload = 만료시각(epoch sec). 쿠키에 비밀번호 원문을 넣지 않는다. */
export function issueToken(now = Date.now()): string {
  const exp = Math.floor(now / 1000) + MAX_AGE_SEC;
  return `${exp}.${sign(String(exp))}`;
}

export function verifyToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;

  const exp = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^\d+$/.test(exp)) return false;
  if (Number(exp) * 1000 < now) return false;

  const expected = sign(exp);
  if (mac.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function passwordMatches(input: unknown, correct: string): boolean {
  if (typeof input !== 'string') return false;
  const a = Buffer.from(input);
  const b = Buffer.from(correct);
  // 길이가 다르면 timingSafeEqual이 던지므로 길이를 맞춰 비교한 뒤 길이도 함께 검사
  const len = Math.max(a.length, b.length);
  const pa = Buffer.alloc(len);
  const pb = Buffer.alloc(len);
  a.copy(pa); b.copy(pb);
  return timingSafeEqual(pa, pb) && a.length === b.length;
}

export const COOKIE_MAX_AGE = MAX_AGE_SEC;
