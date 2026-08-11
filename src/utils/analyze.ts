import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import type {
  V3SearchInput, ScanSettings, V3AnalysisResult, PromptScanResult, PromptItem, EngineSummary,
} from '@/types/v3';
import type { CompetitorRank, KeywordDetail, WeakKeyword } from '@/types/ranking';
import { isMentioned, findPosition, rankCompetitors, averagePosition, findWeakKeywords } from './ranking';

// 모델 ID — 2026-08-11 기준 실제 API 조회로 확인한 현행 모델.
// 모델이 은퇴하면 스캔 전체가 실패하므로, SOV가 0%로 나오면 여기부터 확인할 것.
const GEMINI_MODEL = 'gemini-3.5-flash';
const OPENAI_MODEL = 'gpt-5.4-mini';

const TIMEOUT_MS = 30000;

// 동시 실행 폭. 프롬프트 단위 × 엔진별 요청 단위로 겹쳐서 엔진당 최대 30개가 동시에 나간다.
// 2026-08-11 실측(Gemini 30콜): 3×5 = 23초 / 6×5 = 16초, 양쪽 다 실패 0건.
// 더 올리면 rate limit 위험이 커지므로 여기서 멈춘다.
const PROMPT_CONCURRENCY = 6;
const QUERY_CONCURRENCY = 5;

/**
 * ok=false면 응답을 얻지 못한 것(오류/타임아웃/빈 응답)이다.
 * '노출 안 됨'과 반드시 구분해서 SOV 분모에서 제외한다.
 * 합치면 API 장애 시 "이 치과는 AI에 안 뜬다"는 정반대 결론의 허위 리포트가 나간다.
 */
interface QueryResult {
  mentioned: boolean;
  responseText: string;
  ok: boolean;
  position: number | null;
}

function isMentionedAny(text: string, names: string[]): boolean {
  return names.some(n => isMentioned(text, n));
}

/** 등록된 이름 여러 개 중 가장 앞선 순위를 취한다 */
function findPositionAny(text: string, names: string[]): number | null {
  const found = names.map(n => findPosition(text, n)).filter((p): p is number => p !== null);
  return found.length > 0 ? Math.min(...found) : null;
}

function evaluate(text: string, names: string[]): { mentioned: boolean; position: number | null } {
  return { mentioned: isMentionedAny(text, names), position: findPositionAny(text, names) };
}

async function queryGemini(prompt: string, names: string[]): Promise<QueryResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { mentioned: false, responseText: '[API 키 없음]', ok: false, position: null };
  }
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const text = (result.text || '').trim();
    if (!text) return { mentioned: false, responseText: '[빈 응답]', ok: false, position: null };
    return { ...evaluate(text, names), responseText: text, ok: true };
  } catch (error) {
    console.error('Gemini error:', error);
    return {
      mentioned: false,
      responseText: `[오류] ${error instanceof Error ? error.message : String(error)}`,
      ok: false,
      position: null,
    };
  }
}

async function queryChatGPT(prompt: string, names: string[]): Promise<QueryResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { mentioned: false, responseText: '[API 키 없음]', ok: false, position: null };
  }
  try {
    // maxRetries 0 — 크레딧 소진·쿼터 오류(4xx)에 SDK 기본 2회 재시도로 시간을 버리지 않는다
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: prompt,
      tools: [{ type: 'web_search' }],
    });
    const text = (response.output_text || '').trim();
    if (!text) return { mentioned: false, responseText: '[빈 응답]', ok: false, position: null };
    return { ...evaluate(text, names), responseText: text, ok: true };
  } catch (error) {
    console.error('ChatGPT error:', error);
    return {
      mentioned: false,
      responseText: `[오류] ${error instanceof Error ? error.message : String(error)}`,
      ok: false,
      position: null,
    };
  }
}

const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  new Promise(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(res => { clearTimeout(timer); resolve(res); })
           .catch(err => { clearTimeout(timer); console.error(err); resolve(fallback); });
  });

const FALLBACK: QueryResult = {
  mentioned: false,
  responseText: '[타임아웃] 응답 시간이 초과되었습니다.',
  ok: false,
  position: null,
};

/** Run N concurrent queries with a concurrency cap */
async function runBatch<T>(tasks: Array<() => Promise<T>>, concurrency = 5): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency).map(fn => fn());
    results.push(...await Promise.all(batch));
  }
  return results;
}

/** 응답을 받은 건수만 분모로 삼는다 */
function sov(mentions: number, answered: number): number {
  return answered > 0 ? Number(((mentions / answered) * 100).toFixed(1)) : 0;
}

function summarize(results: QueryResult[]): EngineSummary {
  const answered = results.filter(r => r.ok).length;
  const mentions = results.filter(r => r.mentioned).length;
  return {
    total: results.length,
    answered,
    failed: results.length - answered,
    mentions,
    sov: sov(mentions, answered),
  };
}

/**
 * 취약 키워드 분석은 프롬프트당 엔진별 대표 응답 1건이 필요하다.
 * 우리가 가장 잘 나온 응답(순위가 앞선 것)을 대표로 삼아 과소평가를 피한다.
 */
function pickRepresentative(results: QueryResult[]): QueryResult | null {
  const ok = results.filter(r => r.ok);
  if (ok.length === 0) return null;
  const ranked = ok.filter(r => r.position !== null);
  if (ranked.length > 0) {
    return ranked.reduce((best, r) => (r.position! < best.position! ? r : best));
  }
  return ok[0];
}

export async function runAnalysisV3(
  input: V3SearchInput,
  selectedPrompts: PromptItem[],
  settings: ScanSettings,
  onProgress?: (done: number, total: number) => void,
): Promise<V3AnalysisResult> {
  const names = [input.clinicFullName, input.clinicShortName].filter(Boolean);
  let completed = 0;

  const processPrompt = async (promptItem: PromptItem): Promise<PromptScanResult> => {
    const gptTasks = Array.from({ length: settings.chatgptCount }, () =>
      () => withTimeout(queryChatGPT(promptItem.text, names), TIMEOUT_MS, FALLBACK));
    const gemTasks = Array.from({ length: settings.geminiCount }, () =>
      () => withTimeout(queryGemini(promptItem.text, names), TIMEOUT_MS, FALLBACK));

    const [gptResults, gemResults] = await Promise.all([
      runBatch(gptTasks, QUERY_CONCURRENCY),
      runBatch(gemTasks, QUERY_CONCURRENCY),
    ]);

    completed++;
    onProgress?.(completed, selectedPrompts.length);

    return {
      prompt: promptItem,
      chatgpt: {
        ...summarize(gptResults),
        responseTexts: gptResults.map(r => r.responseText),
        positions: gptResults.map(r => r.position),
        oks: gptResults.map(r => r.ok),
      },
      gemini: {
        ...summarize(gemResults),
        responseTexts: gemResults.map(r => r.responseText),
        positions: gemResults.map(r => r.position),
        oks: gemResults.map(r => r.ok),
      },
    };
  };

  const promptResults = await runBatch(selectedPrompts.map(p => () => processPrompt(p)), PROMPT_CONCURRENCY);

  // ── 집계 ──────────────────────────────────────────────────────
  const sum = (get: (p: PromptScanResult) => number) => promptResults.reduce((s, p) => s + get(p), 0);

  const chatgpt: EngineSummary = {
    total: sum(p => p.chatgpt.total),
    answered: sum(p => p.chatgpt.answered),
    failed: sum(p => p.chatgpt.failed),
    mentions: sum(p => p.chatgpt.mentions),
    sov: sov(sum(p => p.chatgpt.mentions), sum(p => p.chatgpt.answered)),
  };
  const gemini: EngineSummary = {
    total: sum(p => p.gemini.total),
    answered: sum(p => p.gemini.answered),
    failed: sum(p => p.gemini.failed),
    mentions: sum(p => p.gemini.mentions),
    sov: sov(sum(p => p.gemini.mentions), sum(p => p.gemini.answered)),
  };

  // 동시 노출률: 양쪽 엔진 모두에서 노출된 프롬프트 비율.
  // 기존 '일치율'은 양쪽 다 미노출도 일치로 세어, 0%인데 100%로 보이는 역설이 있었다.
  const bothVisible = promptResults.filter(p => p.chatgpt.mentions > 0 && p.gemini.mentions > 0).length;
  const comparable = promptResults.filter(p => p.chatgpt.answered > 0 && p.gemini.answered > 0).length;

  // 경쟁사 랭킹 — 응답을 받은 원문만, canonicalKey로 표기 통일해서 집계
  const okTexts = promptResults.flatMap(p => [
    ...p.chatgpt.responseTexts.filter((_, i) => p.chatgpt.oks[i]),
    ...p.gemini.responseTexts.filter((_, i) => p.gemini.oks[i]),
  ]);

  const totalAnswered = chatgpt.answered + gemini.answered;
  const competitors = rankCompetitors(okTexts, input.clinicFullName, totalAnswered);

  // 우리 병원을 같은 척도로 랭킹에 합류시킨다
  const ourPositions = promptResults.flatMap(p => [...p.chatgpt.positions, ...p.gemini.positions]);
  const ourMentions = chatgpt.mentions + gemini.mentions;
  const ourEntry: CompetitorRank = {
    name: input.clinicFullName,
    mentions: ourMentions,
    exposureRate: sov(ourMentions, totalAnswered),
    avgPosition: averagePosition(ourPositions) ?? 0,
    isTarget: true,
  };
  const competitorRankings = [...competitors, ...(ourMentions > 0 ? [ourEntry] : [])]
    .sort((a, b) => b.mentions - a.mentions || a.avgPosition - b.avgPosition)
    .slice(0, 15);

  // 취약 키워드 — 프롬프트별 대표 응답으로 판정
  const details: KeywordDetail[] = promptResults.map(p => {
    const gptRep = pickRepresentative(
      p.chatgpt.responseTexts.map((t, i) => ({
        mentioned: p.chatgpt.positions[i] !== null,
        responseText: t,
        ok: p.chatgpt.oks[i],
        position: p.chatgpt.positions[i],
      })));
    const gemRep = pickRepresentative(
      p.gemini.responseTexts.map((t, i) => ({
        mentioned: p.gemini.positions[i] !== null,
        responseText: t,
        ok: p.gemini.oks[i],
        position: p.gemini.positions[i],
      })));
    return {
      keyword: p.prompt.displayText || p.prompt.text,
      chatgptResponseText: gptRep?.responseText ?? '',
      geminiResponseText: gemRep?.responseText ?? '',
      chatgptOk: gptRep !== null,
      geminiOk: gemRep !== null,
      chatgptPosition: gptRep?.position ?? null,
      geminiPosition: gemRep?.position ?? null,
    };
  });
  const weakKeywords: WeakKeyword[] = findWeakKeywords(details, input.clinicFullName);

  return {
    input,
    settings,
    scanDate: new Date().toISOString(),
    schemaVersion: 2,
    promptResults,
    summary: {
      chatgpt,
      gemini,
      overall: { sov: sov(ourMentions, totalAnswered) },
      totalAnswered,
      totalFailed: chatgpt.failed + gemini.failed,
      bothVisibleRate: comparable > 0 ? Number(((bothVisible / comparable) * 100).toFixed(1)) : 0,
      avgPosition: averagePosition(ourPositions),
    },
    competitorRankings,
    weakKeywords,
  };
}
