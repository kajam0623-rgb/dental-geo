// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { runAnalysisV3 } from '@/utils/analyze';
import type { PromptItem } from '@/types/v3';

for (const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g,'');
}
const SUF = ' 추천하는 치과 이름만 짧게 알려줘.';
const PROMPTS: PromptItem[] = [
  '가양역 근처 임플란트 잘하는 치과 추천해줘',
  '등촌동 사랑니 발치 잘하는 치과 어디야?',
].map((t,i)=>({ id:`p${i}`, text:t+SUF, displayText:t, category:'지역형' as const }));

describe('AI 인용 출처 수집', () => {
  it('실 스캔에서 출처 도메인과 AI 검색어가 잡힌다', async () => {
    const r = await runAnalysisV3(
      { clinicFullName: '연세두리치과의원', clinicShortName: '연세두리치과', treatments: ['임플란트'], regions: ['가양역'] },
      PROMPTS,
      { chatgptCount: 0 as unknown as 3, geminiCount: 3 },
    );
    console.log('\n── AI가 참고한 출처 ──');
    r.citations.forEach((c,i)=>console.log(`  ${i+1}. ${c.domain}  ${c.count}회 (응답의 ${c.rate}%)`));
    console.log('\n── AI가 실제로 검색한 키워드 ──');
    r.searchQueries.slice(0,10).forEach(q=>console.log('  ·',q));
    console.log('\nSOV', r.summary.gemini.sov+'%', '| 평균순위', r.summary.avgPosition);

    expect(r.citations.length).toBeGreaterThan(0);
    expect(r.searchQueries.length).toBeGreaterThan(0);
    r.citations.forEach(c => expect(c.domain).toMatch(/\./));
  }, 300000);
});
