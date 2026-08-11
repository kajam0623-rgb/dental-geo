import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import Home from '@/app/page';
import type { V3AnalysisResult } from '@/types/v3';

// 실제 화면 전환(home → input → prompts → loading → results)을 앱 코드 그대로 구동한다.
// 네트워크만 가짜로 대체한다.

const RESULT: V3AnalysisResult = {
  input: { clinicFullName: '하루플란트치과의원', clinicShortName: '', treatments: ['임플란트'], regions: ['강남역'] },
  settings: { chatgptCount: 3, geminiCount: 3 },
  scanDate: '2026-08-11T02:00:00.000Z',
  schemaVersion: 2,
  promptResults: [{
    prompt: { id: 'p1', text: 'q' , displayText: '강남역 임플란트 잘하는 치과', category: '지역형' },
    chatgpt: {
      total: 3, answered: 0, failed: 3, mentions: 0, sov: 0,
      responseTexts: ['[오류] no credits', '[오류] no credits', '[오류] no credits'],
      positions: [null, null, null], oks: [false, false, false],
    },
    gemini: {
      total: 3, answered: 3, failed: 0, mentions: 3, sov: 100,
      responseTexts: ['1. 하루플란트치과의원 2. 똑똑플란트치과의원', '1. 하루플란트치과의원', '2. 하루플란트치과의원'],
      positions: [1, 1, 2], oks: [true, true, true],
    },
  }],
  summary: {
    chatgpt: { total: 3, answered: 0, failed: 3, mentions: 0, sov: 0 },
    gemini: { total: 3, answered: 3, failed: 0, mentions: 3, sov: 100 },
    overall: { sov: 100 },
    totalAnswered: 3, totalFailed: 3, bothVisibleRate: 0, avgPosition: 1.3,
  },
  competitorRankings: [
    { name: '하루플란트치과의원', mentions: 3, exposureRate: 100, avgPosition: 1.3, isTarget: true },
    { name: '똑똑플란트치과의원', mentions: 1, exposureRate: 33.3, avgPosition: 2 },
  ],
  weakKeywords: [
    { keyword: '강남역 임플란트 가격', reason: 'absent', bestPosition: null, topCompetitors: ['똑똑플란트치과의원'] },
  ],
};

function sseStream(result: V3AnalysisResult): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      c.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'progress', done: 0, total: 1 })}\n\n`));
      c.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'progress', done: 1, total: 1 })}\n\n`));
      c.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'done', data: result })}\n\n`));
      c.close();
    },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('/api/storage/clinics')) {
      return new Response(JSON.stringify({ success: true, clinics: [] }), { status: 200 });
    }
    if (String(url).includes('/api/generate-prompts')) {
      return new Response(JSON.stringify({ success: false }), { status: 500 }); // 로컬 폴백 경로를 태운다
    }
    if (String(url).includes('/api/analyze-v3')) {
      return new Response(sseStream(RESULT), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }
    return new Response('{}', { status: 200 });
  }));
});

async function gotoPrompts() {
  render(<Home />);
  fireEvent.click(await screen.findByText('새 분석 시작'));

  fireEvent.change(await screen.findByPlaceholderText('강남우리치과의원'), { target: { value: '하루플란트치과의원' } });
  fireEvent.change(screen.getByPlaceholderText('임플란트'), { target: { value: '임플란트' } });
  fireEvent.change(screen.getByPlaceholderText('강남역'), { target: { value: '강남역' } });
  fireEvent.click(screen.getByText('프롬프트 자동 생성'));

  await screen.findByText('프롬프트 설정', {}, { timeout: 5000 });
}

describe('저장소 장애 표면화', () => {
  it('KV가 죽으면 "0개 치과"가 아니라 연결 실패를 알린다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/api/storage/clinics')) {
        return new Response(JSON.stringify({ success: false, error: '저장소를 읽을 수 없습니다.', clinics: [] }), { status: 500 });
      }
      return new Response('{}', { status: 200 });
    }));

    render(<Home />);
    await screen.findByText('저장소 연결 실패');
    expect(document.body.textContent).toContain('저장된 스캔을 불러오거나 새로 저장할 수 없습니다');
  });

  it('정상일 때는 경고가 뜨지 않는다', async () => {
    render(<Home />);
    await screen.findByText('새 분석 시작');
    expect(screen.queryByText('저장소 연결 실패')).toBeNull();
  });
});

describe('전체 화면 흐름', () => {
  it('홈 → 입력 → 프롬프트 화면까지 넘어간다', async () => {
    await gotoPrompts();
    expect(screen.getByText('스캔 시작')).toBeTruthy();
    // 프롬프트 자동 생성 실패 시 로컬 20개로 폴백
    expect(screen.getAllByText('지역형').length).toBeGreaterThan(0);
  });

  it('예상 소요시간이 프롬프트를 고르면 표시된다', async () => {
    const { container } = { container: document.body };
    await gotoPrompts();
    expect(container.textContent).not.toContain('예상 소요');

    fireEvent.click(screen.getAllByText(/강남역/)[1]);
    await waitFor(() => expect(container.textContent).toContain('예상 소요'));
    expect(container.textContent).toMatch(/총 API 호출: *\d+회/);
  });

  it('스캔하면 진행률이 뜨고 결과 화면까지 도달한다', async () => {
    await gotoPrompts();
    fireEvent.click(screen.getAllByText(/강남역/)[1]);
    fireEvent.click(screen.getByText('스캔 시작'));

    // 결과 도달
    await screen.findByText('AI 검색 통합 점유율 리포트', {}, { timeout: 5000 })
      .catch(() => screen.findByText('AI 콘텐츠 전략 보고서', {}, { timeout: 5000 }));

    const text = document.body.textContent ?? '';

    // 실패 배너 — 오류를 '노출 안 됨'과 구분
    expect(text).toContain('3건의 질의가 응답을 받지 못했습니다');
    expect(text).toContain('점유율 계산에서 제외했습니다');

    // 응답 기준 분모
    expect(text).toContain('응답 3회 기준');
    expect(text).toContain('0 / 응답 0회');   // ChatGPT
    expect(text).toContain('3 / 응답 3회');   // Gemini

    // 평균 순위
    expect(text).toContain('평균 추천 순위');
    expect(text).toContain('1.3위');

    // 동시 노출률 (구 '엔진 일치율' 대체)
    expect(text).toContain('동시 노출률');
    expect(text).not.toContain('엔진 일치율');

    // 경쟁사 랭킹에 평균 순위
    expect(text).toContain('평균 1.3위');
    expect(text).toContain('우리 병원');

    // 취약 키워드
    expect(text).toContain('우선 공략 키워드');
    expect(text).toContain('AI 추천 목록에 아예 없음');
    expect(text).toContain('똑똑플란트치과의원');

    // 응답 실패 표시
    expect(text).toContain('응답 실패 (집계 제외)');
  }, 30000);
});
