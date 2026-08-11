// @vitest-environment node
// SSE 스트림 실검증 — analyze-v3 라우트를 직접 호출한다
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { POST } = await import('@/app/api/analyze-v3/route');

const body = {
  input: { clinicFullName: '하루플란트치과의원', clinicShortName: '', treatments: ['임플란트'], regions: ['강남역'] },
  selectedPrompts: [
    { id: 'p1', text: '강남역 임플란트 잘하는 치과 추천해줘 추천하는 치과 이름만 짧게 알려줘.', displayText: '강남역 임플란트', category: '지역형' },
    { id: 'p2', text: '강남역 임플란트 후기 좋은 치과 알려줘 추천하는 치과 이름만 짧게 알려줘.', displayText: '강남역 임플란트 후기', category: '지역형' },
  ],
  settings: { chatgptCount: 3, geminiCount: 3 },
};

const req = (b: unknown) => new Request('http://x/api/analyze-v3', { method: 'POST', body: JSON.stringify(b) });

describe('analyze-v3 SSE', () => {
  it('입력 검증 실패는 스트림이 아니라 400 JSON', async () => {
    const res = await POST(req({ ...body, selectedPrompts: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('프롬프트');
  });

  it('진행률 이벤트가 순서대로 오고 마지막에 결과가 온다', async () => {
    const res = await POST(req(body));
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const events: Array<Record<string, unknown>> = [];

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';
      for (const p of parts) {
        if (!p.trim().startsWith('data:')) continue;
        events.push(JSON.parse(p.trim().slice(5)));
      }
    }

    const progress = events.filter(e => e.type === 'progress');
    const done = events.find(e => e.type === 'done');

    console.log('\n진행률 이벤트:', progress.map(p => `${p.done}/${p.total}`).join(' → '));
    console.log('done 이벤트 수신:', !!done);

    expect(progress.length).toBeGreaterThanOrEqual(3);          // 0/2, 1/2, 2/2
    expect(progress[0]).toMatchObject({ done: 0, total: 2 });
    expect(progress.at(-1)).toMatchObject({ done: 2, total: 2 });
    expect(done).toBeTruthy();

    const data = done!.data as { summary: { gemini: { mentions: number; answered: number } }, promptResults: unknown[] };
    console.log('결과 Gemini:', JSON.stringify(data.summary.gemini));
    expect(data.promptResults).toHaveLength(2);
    expect(data.summary.gemini.answered).toBeGreaterThan(0);
  }, 300000);
});
