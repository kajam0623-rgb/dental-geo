export function generatePrompts(region: string, treatment: string): string[] {
  const safeRegion = region.trim();
  const safeTreatment = treatment.trim();

  // 기본 마스터 템플릿 세트 (실제 소비자들이 검색할 법한 롱테일 키워드들)
  // Task 4: 프롬프트 끝에 구체적 지시문을 덧붙여 AI가 병원명을 확정적으로 나열하도록 유도 (토큰 절약을 위해 짧게 요구)
  const suffix = " 답변 시 반드시 실제로 존재하는 특정 병원(치과)의 이름만 3~5개 짧게 나열해 주세요. 부연 설명은 생략하세요.";

  const templates = [
    `${safeRegion} 주변 ${safeTreatment} 잘하는 치과 추천해줘`,
    `${safeRegion} ${safeTreatment} 전문 치과는 어디가 좋아?`,
    `${safeRegion}에서 ${safeTreatment} 후기 좋은 치과 알려줘`,
    `최근 ${safeRegion} 양심적인 ${safeTreatment} 치과 알아?`,
    `${safeRegion} ${safeTreatment} 가격 합리적인 치과가 어딜까?`,
    `${safeRegion} 근처에 ${safeTreatment} 시술 안 아프게 잘하는 곳 추천 좀!`,
    `${safeRegion} 시설 좋은 ${safeTreatment} 치과 리스트 정리해줘`,
    `${safeRegion} 직장인 야간진료 하는 ${safeTreatment} 치과 찾아봐 줘`,
    `${safeRegion} ${safeTreatment} 잘하는 원장님 있는 치과 어디야?`,
    `${safeRegion} ${safeTreatment} 비용 및 리뷰 좋은 곳 Top 3 알려줘`
  ];

  return templates.map(t => t + suffix);
}
