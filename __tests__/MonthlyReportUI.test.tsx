import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import MonthlyReport from '@/components/MonthlyReport';
import type { MonthlyReport as Report } from '@/utils/monthlyReport';

const base: Report = {
  currentDate: '2026-09-01T00:00:00.000Z',
  previousDate: '2026-08-01T00:00:00.000Z',
  spanDays: 31,
  sov: { current: 35, previous: 20, delta: 15 },
  position: { current: 1.5, previous: 4, delta: 2.5 },
  risingCompetitors: [{ name: '서울맥치과의원', currentRate: 55, previousRate: 40, delta: 15 }],
  fallingCompetitors: [{ name: '고르다치과의원', currentRate: 10, previousRate: 30, delta: -20 }],
  newCitations: ['ysdoori.co.kr'],
  lostCitations: ['modoodoc.com'],
  fixedKeywords: ['가양역 임플란트 가격'],
  newWeakKeywords: ['강서구 교정'],
};

describe('월간 리포트 화면', () => {
  it('기간과 두 핵심 지표를 보여준다', () => {
    render(<MonthlyReport report={base} />);
    const t = document.body.textContent ?? '';
    expect(t).toContain('월간 변화 리포트');
    expect(t).toContain('2026.08.01 → 2026.09.01');
    expect(t).toContain('31일 간격');
    expect(t).toContain('35%');
    expect(t).toContain('이전 20%');
    expect(t).toContain('+15%p');
    expect(t).toContain('1.5위');
    expect(t).toContain('이전 4위');
  });

  it('순위 개선은 계단 수로 양수 표기한다', () => {
    render(<MonthlyReport report={base} />);
    expect(document.body.textContent).toContain('+2.5계단');
  });

  it('경쟁사 상승/하락을 나눠 보여준다', () => {
    render(<MonthlyReport report={base} />);
    const t = document.body.textContent ?? '';
    expect(t).toContain('치고 올라온 곳');
    expect(t).toContain('서울맥치과의원');
    expect(t).toContain('40% → 55%');
    expect(t).toContain('밀려난 곳');
    expect(t).toContain('고르다치과의원');
  });

  it('인용 출처 변동과 키워드 변동을 보여준다', () => {
    render(<MonthlyReport report={base} />);
    const t = document.body.textContent ?? '';
    expect(t).toContain('새로 참고하기 시작한 곳');
    expect(t).toContain('ysdoori.co.kr');
    expect(t).toContain('더 이상 안 보는 곳');
    expect(t).toContain('modoodoc.com');
    expect(t).toContain('해결됨');
    expect(t).toContain('가양역 임플란트 가격');
    expect(t).toContain('새로 밀린 키워드');
    expect(t).toContain('강서구 교정');
  });

  it('SOV가 떨어지면 하락으로 표기한다', () => {
    render(<MonthlyReport report={{ ...base, sov: { current: 12, previous: 30, delta: -18 } }} />);
    expect(document.body.textContent).toContain('-18%p');
  });

  it('변화가 없으면 변화 없음으로 적는다', () => {
    render(<MonthlyReport report={{ ...base, sov: { current: 20, previous: 20, delta: 0 } }} />);
    expect(document.body.textContent).toContain('변화 없음');
  });

  it('미노출이면 순위를 비교 불가로 처리한다', () => {
    render(<MonthlyReport report={{ ...base, position: { current: null, previous: null, delta: null } }} />);
    const t = document.body.textContent ?? '';
    expect(t).toContain('미노출');
    expect(t).toContain('비교 불가');
  });

  it('변동이 없는 섹션은 아예 그리지 않는다', () => {
    render(<MonthlyReport report={{
      ...base,
      risingCompetitors: [], fallingCompetitors: [],
      newCitations: [], lostCitations: [],
      fixedKeywords: [], newWeakKeywords: [],
    }} />);
    expect(screen.queryByText('경쟁사 판도')).toBeNull();
    expect(screen.queryByText('AI가 보는 출처 변동')).toBeNull();
    expect(screen.queryByText('공략 키워드 변화')).toBeNull();
    // 핵심 지표는 그대로 남는다
    expect(document.body.textContent).toContain('월간 변화 리포트');
  });
});
