// @vitest-environment node
// 실 API 검증 — 기본 test 스크립트에서 제외된다 (.manual.ts). 실행:
//   npx vitest run --config vitest.live.config.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { runAnalysisV3 } from '@/utils/analyze';
import type { PromptItem } from '@/types/v3';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const PROMPTS: PromptItem[] = [{
  id: 'p1',
  text: '강남역 주변 임플란트 잘하는 치과 추천해줘 추천하는 치과 이름만 짧게 알려줘.',
  displayText: '강남역 주변 임플란트 잘하는 치과 추천해줘',
  category: '지역형',
}];

describe('실 API 스캔', () => {
  it('단축명 없이 풀네임만 등록해도 노출을 잡아낸다', async () => {
    const progress: Array<[number, number]> = [];
    const r = await runAnalysisV3(
      // 단축명 비움 — 예전엔 이 조건에서 3/3 추천됐는데도 mentions 0이 나왔다
      { clinicFullName: '하루플란트치과의원', clinicShortName: '', treatments: ['임플란트'], regions: ['강남역'] },
      PROMPTS,
      { chatgptCount: 3, geminiCount: 3 },
      (done, total) => progress.push([done, total]),
    );

    const g = r.promptResults[0].gemini;
    console.log('\n── Gemini 원본 응답 ──');
    g.responseTexts.forEach((t, i) =>
      console.log(`  [${i + 1}] ok=${g.oks[i]} 순위=${g.positions[i]} :: ${t.replace(/\n/g, ' ').slice(0, 100)}`));
    console.log('\nGemini 요약:', JSON.stringify(r.summary.gemini));
    console.log('ChatGPT 요약:', JSON.stringify(r.summary.chatgpt));
    console.log('종합 SOV:', r.summary.overall.sov + '%', '| 평균순위:', r.summary.avgPosition);
    console.log('실패 건수:', r.summary.totalFailed, '/ 총', r.summary.chatgpt.total + r.summary.gemini.total);
    console.log('진행률 이벤트:', JSON.stringify(progress));
    console.log('경쟁사:', r.competitorRankings.map(c => `${c.name}(${c.mentions}, 평균${c.avgPosition}위${c.isTarget ? ', 우리' : ''})`).join(', '));
    console.log('취약 키워드:', JSON.stringify(r.weakKeywords));

    // 검증 1-3: 접미사 변형 매칭
    const inText = g.responseTexts.filter(t => t.includes('하루플란트')).length;
    console.log(`\n원문에 '하루플란트' 포함 ${inText}건 vs 집계 mentions ${r.summary.gemini.mentions}건`);
    expect(r.summary.gemini.mentions).toBe(inText);
    expect(r.summary.gemini.mentions).toBeGreaterThan(0);

    // 검증 1-2: 오류는 분모에서 제외 — ChatGPT는 크레딧 0이라 전량 실패해야 정상
    expect(r.summary.chatgpt.answered + r.summary.chatgpt.failed).toBe(r.summary.chatgpt.total);
    expect(r.summary.totalAnswered).toBe(r.summary.gemini.answered + r.summary.chatgpt.answered);

    // 검증 1-4: 경쟁사 이름 분열 없음 (canonicalKey)
    const keys = r.competitorRankings.map(c => c.name.replace(/(의원|병원)$/, ''));
    expect(new Set(keys).size).toBe(keys.length);

    // 검증 4-2: 진행률 이벤트
    expect(progress.at(-1)).toEqual([1, 1]);
  }, 300000);
});
