import { NextResponse } from 'next/server';
import { runAnalysisV3 } from '@/utils/analyze';
import type { V3SearchInput, ScanSettings, PromptItem } from '@/types/v3';

export const maxDuration = 300;

interface Body {
  input: V3SearchInput;
  selectedPrompts: PromptItem[];
  settings: ScanSettings;
}

function invalid(body: Partial<Body>): string | null {
  if (!body.input?.clinicFullName?.trim()) return '치과명이 필요합니다.';
  if (!Array.isArray(body.selectedPrompts) || body.selectedPrompts.length === 0) return '프롬프트를 선택해 주세요.';
  if (body.selectedPrompts.length > 20) return '프롬프트는 최대 20개까지 가능합니다.';
  if (!body.settings?.chatgptCount || !body.settings?.geminiCount) return '스캔 횟수 설정이 필요합니다.';
  return null;
}

/**
 * SSE로 진행률을 흘려보낸다. 스캔이 100초를 넘길 수 있어
 * 가짜 회전 문구 대신 실제 완료 개수를 보여준다.
 * 이벤트: {type:'progress',done,total} … {type:'done',data} | {type:'error',error}
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '요청을 해석할 수 없습니다.' }, { status: 400 });
  }

  const error = invalid(body);
  if (error) return NextResponse.json({ success: false, error }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      send({ type: 'progress', done: 0, total: body.selectedPrompts.length });

      try {
        const data = await runAnalysisV3(
          body.input,
          body.selectedPrompts,
          body.settings,
          (done, total) => send({ type: 'progress', done, total }),
        );
        send({ type: 'done', data });
      } catch (e) {
        console.error('V3 analysis error:', e);
        send({ type: 'error', error: e instanceof Error ? e.message : '분석 중 오류 발생' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
