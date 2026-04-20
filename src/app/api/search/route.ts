import { NextResponse } from 'next/server';
import { runAnalysis } from '@/utils/analyze';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clinicName, region, treatment } = body;

    // 실제 분석 로직 실행 (Gemini + ChatGPT)
    const result = await runAnalysis({ clinicName, region, treatment });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: '분석 중 오류 발생' }, { status: 500 });
  }
}
