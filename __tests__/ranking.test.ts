import { describe, it, expect } from 'vitest';
import {
  extractRankedClinics,
  findPosition,
  rankCompetitors,
  averagePosition,
  findWeakKeywords,
} from '@/utils/ranking';
import type { KeywordDetail } from '@/types/ranking';

// 실제 Gemini 응답에서 그대로 가져온 형태들
const NUMBERED = `1. 하루플란트치과의원
2. 똑똑플란트치과의원
3. 고르다치과의원 강남점
4. 강남레옹치과의원`;

const BULLETED = `* 강남믿음치과의원
* 화이트드림치과의원
* 똑똑플란트치과의원`;

const BOLD_PROSE = '추천드립니다. **서울바른치과**가 가장 평이 좋고, 다음으로 미소가득치과가 있습니다.';

function detail(over: Partial<KeywordDetail>): KeywordDetail {
  return {
    keyword: '강남역 임플란트 잘하는 치과',
    chatgptResponseText: '',
    geminiResponseText: '',
    chatgptOk: true,
    geminiOk: true,
    chatgptPosition: null,
    geminiPosition: null,
    ...over,
  };
}

describe('extractRankedClinics', () => {
  it('keeps the order of a numbered list', () => {
    expect(extractRankedClinics(NUMBERED)).toEqual([
      '하루플란트치과의원',
      '똑똑플란트치과의원',
      '고르다치과의원',
      '강남레옹치과의원',
    ]);
  });

  it('handles bullet lists', () => {
    expect(extractRankedClinics(BULLETED)).toEqual([
      '강남믿음치과의원',
      '화이트드림치과의원',
      '똑똑플란트치과의원',
    ]);
  });

  it('falls back to scanning prose when there is no list', () => {
    const names = extractRankedClinics(BOLD_PROSE);
    expect(names).toContain('서울바른치과');
    expect(names).toContain('미소가득치과');
  });

  it('returns nothing for an error placeholder', () => {
    expect(extractRankedClinics('[오류 발생] 429 no credits')).toEqual([]);
  });

  it('does not repeat the same clinic', () => {
    const names = extractRankedClinics('1. 서울바른치과\n2. 서울바른치과\n3. 미소치과의원');
    expect(names).toEqual(['서울바른치과', '미소치과의원']);
  });
});

describe('findPosition', () => {
  it('reports the 1-based rank the AI gave', () => {
    expect(findPosition(NUMBERED, '하루플란트치과')).toBe(1);
    expect(findPosition(NUMBERED, '고르다치과')).toBe(3);
  });

  it('returns null when the clinic is absent', () => {
    expect(findPosition(NUMBERED, '연세플러스치과')).toBeNull();
  });

  it('returns null for an unusable clinic name', () => {
    expect(findPosition(NUMBERED, '')).toBeNull();
  });
});

describe('rankCompetitors', () => {
  it('counts mentions across responses and excludes our own clinic', () => {
    const ranked = rankCompetitors([NUMBERED, BULLETED], '하루플란트치과', 2);
    const names = ranked.map((r) => r.name);

    expect(names).not.toContain('하루플란트치과의원');
    expect(ranked[0].name).toBe('똑똑플란트치과의원');
    expect(ranked[0].mentions).toBe(2);
    expect(ranked[0].exposureRate).toBe(100);
  });

  it('averages the position a competitor appears at', () => {
    const ranked = rankCompetitors([NUMBERED, BULLETED], '하루플란트치과', 2);
    // 똑똑플란트: 2번째, 3번째 → 평균 2.5
    expect(ranked[0].avgPosition).toBe(2.5);
  });

  it('returns an empty list when nothing was answered', () => {
    expect(rankCompetitors([], '하루플란트치과', 0)).toEqual([]);
  });

  it('merges the same clinic written with and without the 의원 suffix', () => {
    const ranked = rankCompetitors(
      ['1. 강남레옹치과의원\n2. 미소치과의원', '1. 강남레옹치과\n2. 미소치과의원'],
      '하루플란트치과',
      2,
    );
    const leon = ranked.filter((r) => r.name.startsWith('강남레옹'));
    expect(leon).toHaveLength(1);
    expect(leon[0].mentions).toBe(2);
    // 더 완전한 표기를 대표 이름으로 쓴다
    expect(leon[0].name).toBe('강남레옹치과의원');
  });
});

describe('averagePosition', () => {
  it('ignores nulls', () => {
    expect(averagePosition([1, null, 4])).toBe(2.5);
  });

  it('is null when never exposed', () => {
    expect(averagePosition([null, null])).toBeNull();
  });
});

describe('findWeakKeywords', () => {
  it('flags a keyword where the clinic never appears', () => {
    const weak = findWeakKeywords(
      [detail({ chatgptResponseText: NUMBERED, geminiResponseText: NUMBERED })],
      '연세플러스치과',
    );
    expect(weak).toHaveLength(1);
    expect(weak[0].reason).toBe('absent');
    expect(weak[0].bestPosition).toBeNull();
    expect(weak[0].topCompetitors).toEqual(['하루플란트치과의원', '똑똑플란트치과의원', '고르다치과의원']);
  });

  it('flags a keyword where the clinic ranks below the fold', () => {
    const weak = findWeakKeywords(
      [detail({ chatgptResponseText: NUMBERED, geminiResponseText: NUMBERED, chatgptPosition: 4, geminiPosition: 4 })],
      '강남레옹치과의원',
    );
    expect(weak[0].reason).toBe('low');
    expect(weak[0].bestPosition).toBe(4);
    // 우리보다 앞선 3곳만, 우리 자신은 빠져야 한다
    expect(weak[0].topCompetitors).not.toContain('강남레옹치과의원');
    expect(weak[0].topCompetitors).toHaveLength(3);
  });

  it('does not flag a keyword where the clinic ranks near the top', () => {
    const weak = findWeakKeywords(
      [detail({ chatgptResponseText: NUMBERED, geminiResponseText: NUMBERED, chatgptPosition: 1, geminiPosition: 3 })],
      '하루플란트치과',
    );
    expect(weak).toEqual([]);
  });

  it('skips keywords where both engines failed — no evidence either way', () => {
    const weak = findWeakKeywords(
      [detail({ chatgptOk: false, geminiOk: false, chatgptResponseText: '[오류 발생]', geminiResponseText: '[타임아웃]' })],
      '하루플란트치과',
    );
    expect(weak).toEqual([]);
  });
});
