import { NextResponse } from 'next/server';
import { runDeepAnalysis } from '@/utils/analyze';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clinicName, region, treatment, prompt, repeatCount } = body;

    if (!prompt || !repeatCount) {
      return NextResponse.json({ success: false, error: '프롬프트와 반복 횟수가 필요합니다.' }, { status: 400 });
    }

    const result = await runDeepAnalysis({
      clinicName,
      region,
      treatment,
      prompt,
      repeatCount: Math.min(repeatCount, 20), // 최대 20회 제한
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: '정밀 분석 중 오류 발생' }, { status: 500 });
  }
}
