import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { generatePrompts } from './promptGenerator';
import type { AnalysisResult, KeywordDetail, DeepScanResult, DeepScanAttempt } from './analyzeMock';

// Result type for individual AI query — includes the original response text
interface QueryResult {
  mentioned: boolean;
  responseText: string;
}

// 1. A function to check if the clinic name is mentioned in the response text
function isMentioned(text: string, clinicName: string): boolean {
  // Normalize strings to ignore spaces and cases
  const normalizedText = text.replace(/\s+/g, '').toLowerCase();
  const normalizedClinicName = clinicName.replace(/\s+/g, '').toLowerCase();
  return normalizedText.includes(normalizedClinicName);
}

// 2. Query Gemini with Google Search Grounding — returns full response text
async function queryGemini(prompt: string, clinicName: string): Promise<QueryResult> {
  if (!process.env.GEMINI_API_KEY) return { mentioned: false, responseText: '[API 키 없음]' };
  
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      // @ts-ignore - SDK v0.24.1 types use googleSearchRetrieval but Gemini 2.5+ requires googleSearch
      tools: [{ googleSearch: {} }],
    });
    
    const result = await model.generateContent(prompt);
    const text = result.response.text() || '';
    return { mentioned: isMentioned(text, clinicName), responseText: text.trim() };
  } catch (error) {
    console.error(`Gemini Error on prompt "${prompt}":`, error);
    return { mentioned: false, responseText: `[오류 발생] ${error instanceof Error ? error.message : String(error)}` };
  }
}

// 3. Query ChatGPT — returns full response text
async function queryChatGPT(prompt: string, clinicName: string): Promise<QueryResult> {
  if (!process.env.OPENAI_API_KEY) return { mentioned: false, responseText: '[API 키 없음]' };

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: 'gpt-4o',
      tools: [{ type: 'web_search_preview' as const }],
      tool_choice: 'required',
      input: prompt,
    });

    const text = response.output_text || '';
    return { mentioned: isMentioned(text, clinicName), responseText: text.trim() };
  } catch (error) {
    console.error(`ChatGPT Error on prompt "${prompt}":`, error);
    return { mentioned: false, responseText: `[오류 발생] ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Task 1: Timeout을 30초로 대폭 늘려 LLM이 충분히 답변할 시간을 보장
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then((res) => {
      clearTimeout(timer);
      resolve(res);
    }).catch((err) => {
      clearTimeout(timer);
      console.error('Request timed out or failed:', err);
      resolve(fallback);
    });
  });
};

// 4. Main runAnalysis function
export async function runAnalysis(data: { clinicName: string; region: string; treatment: string }): Promise<AnalysisResult> {
  const prompts = generatePrompts(data.region, data.treatment);
  const keywordDetails: KeywordDetail[] = [];

  let gptMentions = 0;
  let geminiMentions = 0;

  const TIMEOUT_MS = 30000; // Task 1: 6000ms → 30000ms (30초)로 대폭 확대
  const FALLBACK: QueryResult = { mentioned: false, responseText: '[타임아웃] 응답 시간이 초과되었습니다.' };

  // Execute sequentially but with timeout protection
  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    // Rate limit 방지: 첫 번째 외 2초 대기
    if (i > 0) await new Promise(r => setTimeout(r, 2000));

     const [geminiResult, gptResult] = await Promise.all([
       withTimeout(queryGemini(prompt, data.clinicName), TIMEOUT_MS, FALLBACK),
       withTimeout(queryChatGPT(prompt, data.clinicName), TIMEOUT_MS, FALLBACK)
     ]);

     if (geminiResult.mentioned) geminiMentions++;
     if (gptResult.mentioned) gptMentions++;

     keywordDetails.push({
       keyword: prompt,
       chatgptMentioned: gptResult.mentioned,
       geminiMentioned: geminiResult.mentioned,
       chatgptResponseText: gptResult.responseText,
       geminiResponseText: geminiResult.responseText,
     });
  }

  const totalSearches = prompts.length * 2;
  const totalMentions = gptMentions + geminiMentions;

  return {
    totalSearches,
    clinicMentions: totalMentions,
    sovPercentage: totalSearches > 0 ? Number(((totalMentions / totalSearches) * 100).toFixed(1)) : 0,
    details: {
      chatgpt: {
        searches: prompts.length,
        mentions: gptMentions,
        sov: prompts.length > 0 ? Number(((gptMentions / prompts.length) * 100).toFixed(1)) : 0,
      },
      gemini: {
        searches: prompts.length,
        mentions: geminiMentions,
        sov: prompts.length > 0 ? Number(((geminiMentions / prompts.length) * 100).toFixed(1)) : 0,
      }
    },
    keywordDetails,
  };
}

// Deep Scan: 1개 프롬프트를 N번 반복하여 일관성 측정
export async function runDeepAnalysis(data: {
  clinicName: string;
  region: string;
  treatment: string;
  prompt: string;
  repeatCount: number;
}): Promise<DeepScanResult> {
  const attempts: DeepScanAttempt[] = [];
  let chatgptMentions = 0;
  let geminiMentions = 0;

  const TIMEOUT_MS = 30000;
  const FALLBACK: QueryResult = { mentioned: false, responseText: '[타임아웃] 응답 시간이 초과되었습니다.' };

  for (let i = 0; i < data.repeatCount; i++) {
    // Rate limit 방지: 첫 번째 요청 외에는 2초 대기
    if (i > 0) await new Promise(r => setTimeout(r, 2000));

    const [geminiResult, gptResult] = await Promise.all([
      withTimeout(queryGemini(data.prompt, data.clinicName), TIMEOUT_MS, FALLBACK),
      withTimeout(queryChatGPT(data.prompt, data.clinicName), TIMEOUT_MS, FALLBACK)
    ]);

    if (geminiResult.mentioned) geminiMentions++;
    if (gptResult.mentioned) chatgptMentions++;

    attempts.push({
      attemptNumber: i + 1,
      chatgptMentioned: gptResult.mentioned,
      geminiMentioned: geminiResult.mentioned,
      chatgptResponseText: gptResult.responseText,
      geminiResponseText: geminiResult.responseText,
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
