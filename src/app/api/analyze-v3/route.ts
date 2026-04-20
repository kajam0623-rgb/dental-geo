import { NextResponse } from 'next/server';
import { runAnalysisV3 } from '@/utils/analyze';
import type { V3SearchInput, ScanSettings, PromptItem } from '@/types/v3';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input: V3SearchInput = body.input;
    const selectedPrompts: PromptItem[] = body.selectedPrompts;
    const settings: ScanSettings = body.settings;

    if (!input?.clinicFullName || !selectedPrompts?.length || !settings) {
      return NextResponse.json({ success: false, error: '필수 입력값이 누락되었습니다.' }, { status: 400 });
    }

    const result = await runAnalysisV3(input, selectedPrompts, settings);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('V3 analysis error:', error);
    return NextResponse.json({ success: false, error: '분석 중 오류 발생' }, { status: 500 });
  }
}
