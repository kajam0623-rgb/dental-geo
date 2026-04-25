import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { V3SearchInput, PromptItem, PromptCategory } from '@/types/v3';

export const maxDuration = 30;

const VALID_CATEGORIES = new Set<PromptCategory>(['지역형', '증상형', '비교형', '추천형']);
const SUFFIX = ' 추천하는 치과 이름만 짧게 알려줘.';

export async function POST(request: Request) {
  const body = await request.json();
  const input: V3SearchInput = body.input;

  if (!input?.clinicFullName || !input?.treatments?.length || !input?.regions?.length) {
    return NextResponse.json({ success: false, error: '입력값 누락' }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ success: false, error: 'GEMINI_API_KEY 없음' }, { status: 500 });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `너는 치과 마케팅 AI 전문가야. 아래 치과 정보를 바탕으로, 실제 환자들이 ChatGPT·Gemini 같은 AI에게 물어볼 법한 자연스러운 한국어 롱테일 검색 질문 20개를 만들어줘.

치과 정보:
- 치과명: ${input.clinicFullName}
- 진료과목: ${input.treatments.join(', ')}
- 지역: ${input.regions.join(', ')}

규칙:
1. 카테고리 분류 — 지역형 6개, 증상형 5개, 비교형 5개, 추천형 4개 (합계 정확히 20개)
2. 실제 환자 구어체 한국어 (격식체 금지)
3. 치과 풀네임("${input.clinicFullName}") 절대 포함 금지 — 지역명·진료과목 중심으로 작성
4. 지역(${input.regions.join(', ')})과 진료과목(${input.treatments.join(', ')})을 골고루 활용
5. JSON 배열만 출력 (설명·마크다운 없이):

[{"category":"지역형","text":"질문"},...]`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패');

    const parsed: Array<{ category: string; text: string }> = JSON.parse(jsonMatch[0]);

    const prompts: PromptItem[] = parsed
      .filter(p => typeof p.text === 'string' && VALID_CATEGORIES.has(p.category as PromptCategory))
      .slice(0, 20)
      .map((p, i) => ({
        id: `ai-${i}`,
        text: p.text.trim() + SUFFIX,
        displayText: p.text.trim(),
        category: p.category as PromptCategory,
      }));

    if (prompts.length < 10) throw new Error(`생성 프롬프트 부족: ${prompts.length}개`);

    return NextResponse.json({ success: true, prompts });
  } catch (error) {
    console.error('generate-prompts error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
