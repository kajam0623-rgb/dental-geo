import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE, verifyToken } from '@/utils/authToken';

// Next 16에서 middleware 파일 규약이 proxy로 이름이 바뀌었다.
// Proxy는 Node.js 런타임이 기본이며 runtime 설정을 넣으면 에러가 난다.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 로그인 페이지와 인증 API는 통과.
  // keepalive는 Vercel Cron이 호출하므로 비밀번호 게이트를 지나갈 수 없다.
  // 대신 라우트 안에서 CRON_SECRET으로 막는다.
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/keepalive')
  ) {
    return NextResponse.next();
  }

  const password = process.env.ACCESS_PASSWORD;
  // 환경변수 미설정 시 보호 안 함 (로컬 개발 편의)
  if (!password) return NextResponse.next();

  if (verifyToken(request.cookies.get(AUTH_COOKIE)?.value)) {
    return NextResponse.next();
  }

  // API를 redirect하면 클라이언트가 HTML을 JSON으로 파싱하려다
  // "서버와 통신할 수 없습니다"라는 엉뚱한 에러를 띄운다. 401 JSON으로 준다.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: '세션이 만료되었습니다.' }, { status: 401 });
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
