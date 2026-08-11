// @vitest-environment node
// 동시성 실측 — Gemini만 사용(ChatGPT는 크레딧 0). 실호출 비용이 있으므로 수동 실행.
import { describe, it } from 'vitest';
import fs from 'node:fs';
import { runAnalysisV3 } from '@/utils/analyze';
import type { PromptItem } from '@/types/v3';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const SUF = ' 추천하는 치과 이름만 짧게 알려줘.';
const PROMPTS: PromptItem[] = [
  '강남역 주변 임플란트 잘하는 치과 추천해줘',
  '강남역 임플란트 후기 좋은 치과 알려줘',
  '강남역 임플란트 전문 치과는 어디가 좋아?',
  '서초구 임플란트 가격 합리적인 치과 어디야?',
  '강남역 야간진료 하는 임플란트 치과 알려줘',
  '강남역 시설 좋은 임플란트 치과 리스트 정리해줘',
].map((t, i) => ({ id: `p${i}`, text: t + SUF, displayText: t, category: '지역형' as const }));

describe('동시성 실측', () => {
  it('현재 설정(프롬프트 3 × 엔진별 5)에서 6프롬프트 × 5회 소요시간', async () => {
    const t0 = Date.now();
    const marks: Array<[number, number]> = [];
    const r = await runAnalysisV3(
      { clinicFullName: '하루플란트치과의원', clinicShortName: '', treatments: ['임플란트'], regions: ['강남역'] },
      PROMPTS,
      { chatgptCount: 0 as unknown as 3, geminiCount: 5 },
      (done) => marks.push([done, Math.round((Date.now() - t0) / 1000)]),
    );
    const elapsed = Math.round((Date.now() - t0) / 1000);

    console.log(`\n총 Gemini 호출: ${r.summary.gemini.total}회`);
    console.log(`전체 소요: ${elapsed}초 (호출당 평균 ${(elapsed / r.summary.gemini.total).toFixed(2)}초)`);
    console.log('프롬프트 완료 시점(초):', marks.map(([d, s]) => `${d}→${s}s`).join(', '));
    console.log(`응답 성공: ${r.summary.gemini.answered} / 실패: ${r.summary.gemini.failed}`);
    console.log(`SOV ${r.summary.gemini.sov}% · 평균순위 ${r.summary.avgPosition}`);
    console.log('경쟁사 상위 5:', r.competitorRankings.slice(0, 5).map(c => `${c.name}(${c.mentions}회, ${c.avgPosition}위)`).join(', '));
  }, 300000);
});
