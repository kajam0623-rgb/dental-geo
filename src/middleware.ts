import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 로그인 페이지와 인증 API는 통과
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const password = process.env.ACCESS_PASSWORD;
  // 환경변수 미설정 시 보호 안 함 (로컬 개발 편의)
  if (!password) return NextResponse.next();

  const cookie = request.cookies.get('auth')?.value;
  if (cookie === password) return NextResponse.next();

  // 미인증 → 로그인 페이지로
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
