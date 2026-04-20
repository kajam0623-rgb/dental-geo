import { generatePrompts } from "./promptGenerator";

export interface KeywordDetail {
  keyword: string;
  chatgptMentioned: boolean;
  geminiMentioned: boolean;
  chatgptResponseText: string;
  geminiResponseText: string;
}

export interface AnalysisResult {
  totalSearches: number;
  clinicMentions: number;
  sovPercentage: number;
  details: {
    chatgpt: { searches: number; mentions: number; sov: number };
    gemini: { searches: number; mentions: number; sov: number };
  };
  keywordDetails: KeywordDetail[];
}

// Mock competitor clinic names for realistic demo data
const MOCK_COMPETITORS = [
  "서울바른치과", "미소가득치과", "연세플러스치과", "하늘빛치과",
  "드림치과의원", "예쁜미소치과", "삼성S치과", "뉴연세치과",
];

function generateMockResponse(region: string, treatment: string, clinicName: string, isMentioned: boolean): string {
  const competitors = MOCK_COMPETITORS.sort(() => 0.5 - Math.random()).slice(0, 3);
  
  if (isMentioned) {
    return `${region} 지역에서 ${treatment}로 유명한 치과를 추천드립니다.\n\n` +
      `1. **${clinicName}** - 최신 장비와 풍부한 경험을 갖춘 전문 의료진이 상주하고 있으며, 환자 만족도가 매우 높습니다.\n` +
      `2. **${competitors[0]}** - 합리적인 가격과 친절한 상담으로 인기가 많습니다.\n` +
      `3. **${competitors[1]}** - 야간 진료가 가능하여 직장인들에게 편리합니다.\n\n` +
      `위 치과들은 ${region} 주변에서 ${treatment} 시술 경험이 풍부하고 후기가 좋은 곳들입니다.`;
  } else {
    return `${region} 지역에서 ${treatment}로 유명한 치과를 추천드립니다.\n\n` +
      `1. **${competitors[0]}** - 최신 장비를 보유하고 있으며, 환자 만족도가 매우 높습니다.\n` +
      `2. **${competitors[1]}** - 합리적인 가격과 친절한 상담으로 인기가 많습니다.\n` +
      `3. **${competitors[2]}** - 야간 진료가 가능하여 직장인들에게 편리합니다.\n\n` +
      `위 치과들은 ${region} 주변에서 ${treatment} 시술 경험이 풍부하고 후기가 좋은 곳들입니다.`;
  }
}

// ─── Deep Scan Types ───
export interface DeepScanAttempt {
  attemptNumber: number;
  chatgptMentioned: boolean;
  geminiMentioned: boolean;
  chatgptResponseText: string;
  geminiResponseText: string;
}

export interface DeepScanResult {
  prompt: string;
  totalAttempts: number;
  chatgpt: { mentions: number; consistency: number };
  gemini: { mentions: number; consistency: number };
  overallConsistency: number;
  attempts: DeepScanAttempt[];
}

export async function runMockDeepScan(data: {
  clinicName: string;
  region: string;
  treatment: string;
  prompt: string;
  repeatCount: number;
}): Promise<DeepScanResult> {
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const attempts: DeepScanAttempt[] = [];
  let chatgptMentions = 0;
  let geminiMentions = 0;

  for (let i = 0; i < data.repeatCount; i++) {
    const isGptMentioned = Math.random() > 0.55;
    const isGeminiMentioned = Math.random() > 0.65;

    if (isGptMentioned) chatgptMentions++;
    if (isGeminiMentioned) geminiMentions++;

    attempts.push({
      attemptNumber: i + 1,
      chatgptMentioned: isGptMentioned,
      geminiMentioned: isGeminiMentioned,
      chatgptResponseText: generateMockResponse(data.region, data.treatment, data.clinicName, isGptMentioned),
      geminiResponseText: generateMockResponse(data.region, data.treatment, data.clinicName, isGeminiMentioned),
    });
  }

  const chatgptConsistency = Number(((chatgptMentions / data.repeatCount) * 100).toFixed(1));
  const geminiConsistency = Number(((geminiMentions / data.repeatCount) * 100).toFixed(1));
  const totalMentions = chatgptMentions + geminiMentions;
  const overallConsistency = Number(((totalMentions / (data.repeatCount * 2)) * 100).toFixed(1));

  return {
    prompt: data.prompt,
    totalAttempts: data.repeatCount,
    chatgpt: { mentions: chatgptMentions, consistency: chatgptConsistency },
    gemini: { mentions: geminiMentions, consistency: geminiConsistency },
    overallConsistency,
    attempts,
  };
}

export async function runMockAnalysis(data: { clinicName: string; region: string; treatment: string }): Promise<AnalysisResult> {
  // 실제 API를 쏘는 대신, 2~3초 간 인위적인 지연(딜레이)을 주어 진짜처럼 보이게 만듭니다.
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const prompts = generatePrompts(data.region, data.treatment);
  const keywordDetails: KeywordDetail[] = [];

  let gptMentions = 0;
  let geminiMentions = 0;

  prompts.forEach((prompt) => {
    // 랜덤으로 노출 여부 결정 (대략 30~40% 확률로 발견된다고 가정)
    const isGptMentioned = Math.random() > 0.6;
    const isGeminiMentioned = Math.random() > 0.7;

    if (isGptMentioned) gptMentions++;
    if (isGeminiMentioned) geminiMentions++;

    keywordDetails.push({
      keyword: prompt,
      chatgptMentioned: isGptMentioned,
      geminiMentioned: isGeminiMentioned,
      chatgptResponseText: generateMockResponse(data.region, data.treatment, data.clinicName, isGptMentioned),
      geminiResponseText: generateMockResponse(data.region, data.treatment, data.clinicName, isGeminiMentioned),
    });
  });

  const totalSearches = prompts.length * 2;
  const totalMentions = gptMentions + geminiMentions;

  return {
    totalSearches,
    clinicMentions: totalMentions,
    sovPercentage: Number(((totalMentions / totalSearches) * 100).toFixed(1)),
    details: {
      chatgpt: {
        searches: prompts.length,
        mentions: gptMentions,
        sov: Number(((gptMentions / prompts.length) * 100).toFixed(1)),
      },
      gemini: {
        searches: prompts.length,
        mentions: geminiMentions,
        sov: Number(((geminiMentions / prompts.length) * 100).toFixed(1)),
      }
    },
    keywordDetails,
  };
}
