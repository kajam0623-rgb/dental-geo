import { describe, it, expect } from 'vitest';
import { isMentioned, nameVariants } from '@/utils/ranking';

describe('isMentioned', () => {
  it('matches regardless of spacing and punctuation', () => {
    expect(isMentioned('1. **서울바른 치과** 추천합니다', '서울바른치과')).toBe(true);
    expect(isMentioned('추천: 서울-바른치과', '서울바른치과')).toBe(true);
  });

  it('matches when AI drops the 의원 suffix the clinic registered with', () => {
    expect(isMentioned('강남레옹치과를 추천합니다', '강남레옹치과의원')).toBe(true);
  });

  it('matches when AI adds the 의원 suffix', () => {
    expect(isMentioned('하루플란트치과의원이 유명합니다', '하루플란트치과')).toBe(true);
  });

  it('is case insensitive for latin names', () => {
    expect(isMentioned('ABC덴탈 클리닉', 'abc덴탈')).toBe(true);
  });

  it('does not match a different clinic', () => {
    expect(isMentioned('고르다치과의원, 원진치과의원', '연세플러스치과')).toBe(false);
  });

  it('returns false for empty or too-short clinic names', () => {
    expect(isMentioned('아무치과나 추천', '')).toBe(false);
    expect(isMentioned('아무치과나 추천', '  ')).toBe(false);
  });

  it('returns false for error placeholder text', () => {
    expect(isMentioned('[오류 발생] 429 no credits', '서울바른치과')).toBe(false);
  });
});

describe('nameVariants', () => {
  it('adds a suffix-stripped variant', () => {
    expect(nameVariants('강남레옹치과의원')).toEqual(['강남레옹치과의원', '강남레옹치과']);
  });

  it('returns a single variant when there is no strippable suffix', () => {
    expect(nameVariants('서울바른치과')).toEqual(['서울바른치과']);
  });

  it('returns nothing for unusable input', () => {
    expect(nameVariants('')).toEqual([]);
    expect(nameVariants('!!')).toEqual([]);
  });
});
