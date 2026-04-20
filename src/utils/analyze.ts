import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { generatePrompts } from './promptGenerator';
import type { AnalysisResult, KeywordDetail, DeepScanResult, DeepScanAttempt } from './analyzeMock';
import type { V3SearchInput, ScanSettings, V3AnalysisResult, PromptScanResult, CompetitorRank, PromptItem } from '@/types/v3';

interface QueryResult {
  mentioned: boolean;
  responseText: string;
}

function isMentioned(text: string, clinicName: string): boolean {
  const normalizedText = text.replace(/\s+/g, '').toLowerCase();
  const normalizedClinicName = clinicName.replace(/\s+/g, '').toLowerCase();
  return normalizedText.includes(normalizedClinicName);
}

function isMentionedAny(text: string, names: string[]): boolean {
  return names.some(n => isMentioned(text, n));
}

/** Extract bold-formatted clinic names (**name**) from AI response */
function extractCompetitors(text: string): string[] {
  const matches = text.match(/\*\*([^*]{2,20})\*\*/g) ?? [];
  return matches
    .map(m => m.replace(/\*\*/g, '').trim())
    .filter(n => n.length >= 2 && (n.includes('치과') || n.includes('의원') || n.includes('병원')));
}

async function queryGemini(prompt: string, clinicName: string): Promise<QueryResult> {
  if (!process.env.GEMINI_API_KEY) return { mentioned: false, responseText: '[API 키 없음]' };
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      // @ts-ignore
      tools: [{ googleSearch: {} }],
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text() || '';
    return { mentioned: isMentioned(text, clinicName), responseText: text.trim() };
  } catch (error) {
    return { mentioned: false, responseText: `[오류] ${error instanceof Error ? error.message : String(error)}` };
  }
}

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
    return { mentioned: false, responseText: `[오류] ${error instanceof Error ? error.message : String(error)}` };
  }
}

const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  new Promise(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(res => { clearTimeout(timer); resolve(res); })
           .catch(err => { clearTimeout(timer); console.error(err); resolve(fallback); });
  });

const TIMEOUT_MS = 30000;
const FALLBACK: QueryResult = { mentioned: false, responseText: '[타임아웃] 응답 시간이 초과되었습니다.' };

// ─── V3 Analysis ───────────────────────────────────────────────

export async function runAnalysisV3(
  input: V3SearchInput,
  selectedPrompts: PromptItem[],
  settings: ScanSettings,
): Promise<V3AnalysisResult> {
  const allNames = [input.clinicFullName, input.clinicShortName].filter(Boolean);
  const promptResults: PromptScanResult[] = [];
  const competitorCountMap = new Map<string, number>();
  const totalResponses = (settings.chatgptCount + settings.geminiCount) * selectedPrompts.length;

  for (let pi = 0; pi < selectedPrompts.length; pi++) {
    const promptItem = selectedPrompts[pi];
    if (pi > 0) await new Promise(r => setTimeout(r, 1500));

    const chatgptTexts: string[] = [];
    const geminiTexts: string[] = [];
    let chatgptMentions = 0;
    let geminiMentions = 0;

    // Run ChatGPT N times
    for (let i = 0; i < settings.chatgptCount; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 1000));
      const result = await withTimeout(queryChatGPT(promptItem.text, input.clinicFullName), TIMEOUT_MS, FALLBACK);
      if (isMentionedAny(result.responseText, allNames)) chatgptMentions++;
      chatgptTexts.push(result.responseText);
      extractCompetitors(result.responseText).forEach(c => {
        if (!allNames.some(n => isMentioned(c, n))) {
          competitorCountMap.set(c, (competitorCountMap.get(c) ?? 0) + 1);
        }
      });
    }

    // Run Gemini N times
    for (let i = 0; i < settings.geminiCount; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 1000));
      const result = await withTimeout(queryGemini(promptItem.text, input.clinicFullName), TIMEOUT_MS, FALLBACK);
      if (isMentionedAny(result.responseText, allNames)) geminiMentions++;
      geminiTexts.push(result.responseText);
      extractCompetitors(result.responseText).forEach(c => {
        if (!allNames.some(n => isMentioned(c, n))) {
          competitorCountMap.set(c, (competitorCountMap.get(c) ?? 0) + 1);
        }
      });
    }

    promptResults.push({
      prompt: promptItem,
      chatgpt: { mentioned: chatgptMentions, total: settings.chatgptCount, responseTexts: chatgptTexts },
      gemini: { mentioned: geminiMentions, total: settings.geminiCount, responseTexts: geminiTexts },
    });
  }

  // Summary
  const chatgptTotal = settings.chatgptCount * selectedPrompts.length;
  const geminiTotal = settings.geminiCount * selectedPrompts.length;
  const chatgptMentionsTotal = promptResults.reduce((s, p) => s + p.chatgpt.mentioned, 0);
  const geminiMentionsTotal = promptResults.reduce((s, p) => s + p.gemini.mentioned, 0);

  const agreementCount = promptResults.filter(p => {
    const gptHit = p.chatgpt.mentioned > p.chatgpt.total / 2;
    const gemHit = p.gemini.mentioned > p.gemini.total / 2;
    return gptHit === gemHit;
  }).length;

  // Competitor rankings
  const competitorRankings: CompetitorRank[] = Array.from(competitorCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Number(((count / totalResponses) * 100).toFixed(1)),
    }));

  return {
    input,
    settings,
    scanDate: new Date().toISOString(),
    promptResults,
    summary: {
      chatgpt: {
        sov: chatgptTotal > 0 ? Number(((chatgptMentionsTotal / chatgptTotal) * 100).toFixed(1)) : 0,
        mentions: chatgptMentionsTotal,
        total: chatgptTotal,
      },
      gemini: {
        sov: geminiTotal > 0 ? Number(((geminiMentionsTotal / geminiTotal) * 100).toFixed(1)) : 0,
        mentions: geminiMentionsTotal,
        total: geminiTotal,
      },
      overall: {
        sov: (chatgptTotal + geminiTotal) > 0
          ? Number((((chatgptMentionsTotal + geminiMentionsTotal) / (chatgptTotal + geminiTotal)) * 100).toFixed(1))
          : 0,
      },
      agreementRate: selectedPrompts.length > 0
        ? Number(((agreementCount / selectedPrompts.length) * 100).toFixed(1))
        : 0,
    },
    competitorRankings,
  };
}

// ─── Legacy V1 Analysis (kept for backward compatibility) ───────

export async function runAnalysis(data: { clinicName: string; region: string; treatment: string }): Promise<AnalysisResult> {
  const prompts = generatePrompts(data.region, data.treatment);
  const keywordDetails: KeywordDetail[] = [];
  let gptMentions = 0;
  let geminiMentions = 0;

  for (let i = 0; i < prompts.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 2000));
    const [geminiResult, gptResult] = await Promise.all([
      withTimeout(queryGemini(prompts[i], data.clinicName), TIMEOUT_MS, FALLBACK),
      withTimeout(queryChatGPT(prompts[i], data.clinicName), TIMEOUT_MS, FALLBACK),
    ]);
    if (geminiResult.mentioned) geminiMentions++;
    if (gptResult.mentioned) gptMentions++;
    keywordDetails.push({
      keyword: prompts[i],
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
      chatgpt: { searches: prompts.length, mentions: gptMentions, sov: prompts.length > 0 ? Number(((gptMentions / prompts.length) * 100).toFixed(1)) : 0 },
      gemini: { searches: prompts.length, mentions: geminiMentions, sov: prompts.length > 0 ? Number(((geminiMentions / prompts.length) * 100).toFixed(1)) : 0 },
    },
    keywordDetails,
  };
}

// ─── Legacy Deep Scan ───────────────────────────────────────────

export async function runDeepAnalysis(data: {
  clinicName: string; region: string; treatment: string; prompt: string; repeatCount: number;
}): Promise<DeepScanResult> {
  const attempts: DeepScanAttempt[] = [];
  let chatgptMentions = 0;
  let geminiMentions = 0;

  for (let i = 0; i < data.repeatCount; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 2000));
    const [geminiResult, gptResult] = await Promise.all([
      withTimeout(queryGemini(data.prompt, data.clinicName), TIMEOUT_MS, FALLBACK),
      withTimeout(queryChatGPT(data.prompt, data.clinicName), TIMEOUT_MS, FALLBACK),
    ]);
    if (geminiResult.mentioned) geminiMentions++;
    if (gptResult.mentioned) chatgptMentions++;
    attempts.push({ attemptNumber: i + 1, chatgptMentioned: gptResult.mentioned, geminiMentioned: geminiResult.mentioned, chatgptResponseText: gptResult.responseText, geminiResponseText: geminiResult.responseText });
  }

  return {
    prompt: data.prompt,
    totalAttempts: data.repeatCount,
    chatgpt: { mentions: chatgptMentions, consistency: Number(((chatgptMentions / data.repeatCount) * 100).toFixed(1)) },
    gemini: { mentions: geminiMentions, consistency: Number(((geminiMentions / data.repeatCount) * 100).toFixed(1)) },
    overallConsistency: Number((((chatgptMentions + geminiMentions) / (data.repeatCount * 2)) * 100).toFixed(1)),
    attempts,
  };
}
