import type { PromptItem, PromptCategory } from '@/types/v3';

const SUFFIX = ' 각 치과마다 선정 이유와 장점 하나씩만 간단히 써주세요.';

/** Legacy: used by old search API */
export function generatePrompts(region: string, treatment: string): string[] {
  return generatePromptsV3([region], [treatment]).slice(0, 10).map(p => p.text);
}

/** V3: generates 20 categorized prompts from multiple regions & treatments */
export function generatePromptsV3(regions: string[], treatments: string[]): PromptItem[] {
  const r = regions[0] ?? '';
  const r2 = regions[1] ?? r;
  const r3 = regions[2] ?? r;
  const t = treatments[0] ?? '';
  const t2 = treatments[1] ?? t;
  const t3 = treatments[2] ?? t;

  const templates: Array<{ text: string; category: PromptCategory }> = [
    // 지역형 (6개)
    { text: `${r} 주변 ${t} 잘하는 치과 추천해줘`, category: '지역형' },
    { text: `${r} ${t} 전문 치과는 어디가 좋아?`, category: '지역형' },
    { text: `${r2}에서 ${t2} 후기 좋은 치과 알려줘`, category: '지역형' },
    { text: `${r2} 시설 좋은 ${t} 치과 리스트 정리해줘`, category: '지역형' },
    { text: `${r3} 근처 ${t3} 잘하고 가격 합리적인 치과 어디야?`, category: '지역형' },
    { text: `${r3} ${t3} 직장인이 가기 좋은 야간진료 치과 추천해줘`, category: '지역형' },

    // 증상형 (5개)
    { text: `치아가 많이 흔들리는데 ${r}에서 ${t} 잘하는 치과 찾아줘`, category: '증상형' },
    { text: `임플란트 실패 후 ${r} 재수술 전문 치과 어디야?`, category: '증상형' },
    { text: `${t} 시술 후 통증 없이 잘 해주는 ${r} 치과 알려줘`, category: '증상형' },
    { text: `치과 공포증 있는데 ${r} 에서 ${t} 무통으로 잘하는 곳?`, category: '증상형' },
    { text: `${r}에서 ${t2} 빠르게 원데이로 끝낼 수 있는 치과 알아?`, category: '증상형' },

    // 비교형 (5개)
    { text: `${r} ${t} 치과 어디가 제일 싸고 잘해? 비교해줘`, category: '비교형' },
    { text: `${r} 치과 중 ${t} 최신 장비 제일 잘 갖춘 곳은?`, category: '비교형' },
    { text: `${r} ${t2} 치과 가격 비교해서 Top 3 알려줘`, category: '비교형' },
    { text: `${r} 에서 ${t} vs ${t2} 같이 할 수 있는 치과 있어?`, category: '비교형' },
    { text: `${r2} 치과들 중 ${t} 전문의 있는 곳만 골라줘`, category: '비교형' },

    // 추천형 (4개)
    { text: `${r} ${t} 환자 만족도 높은 치과 솔직히 추천해줘`, category: '추천형' },
    { text: `지인한테 ${r} ${t} 치과 추천해야 하는데 어디가 좋을까?`, category: '추천형' },
    { text: `${r} ${t} 믿을 수 있는 치과 원장님 있는 곳 알려줘`, category: '추천형' },
    { text: `${r} 에서 ${t3} 오래 다닐 만한 단골 치과 추천해줘`, category: '추천형' },
  ];

  return templates.map((t, i) => ({
    id: `prompt-${i}`,
    text: t.text + SUFFIX,
    displayText: t.text,
    category: t.category,
  }));
}
