// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { issueToken, verifyToken, passwordMatches } from '@/utils/authToken';

beforeAll(() => {
  process.env.ACCESS_PASSWORD = 'correct-horse';
  process.env.AUTH_SECRET = 'test-secret';
});

describe('authToken', () => {
  it('발급한 토큰은 검증을 통과한다', () => {
    expect(verifyToken(issueToken())).toBe(true);
  });

  it('쿠키 값에 비밀번호 원문이 들어가지 않는다', () => {
    expect(issueToken()).not.toContain('correct-horse');
  });

  it('예전 방식(비밀번호 원문 쿠키)은 거부한다', () => {
    expect(verifyToken('correct-horse')).toBe(false);
  });

  it('서명이 조작된 토큰은 거부한다', () => {
    const t = issueToken();
    const tampered = t.slice(0, -1) + (t.endsWith('a') ? 'b' : 'a');
    expect(verifyToken(tampered)).toBe(false);
  });

  it('만료시각을 미래로 늘려도 서명이 안 맞아 거부한다', () => {
    const mac = issueToken().split('.')[1];
    expect(verifyToken(`99999999999.${mac}`)).toBe(false);
  });

  it('만료된 토큰은 거부한다', () => {
    const past = Date.now() - 1000 * 60 * 60 * 24 * 365;
    expect(verifyToken(issueToken(past), Date.now())).toBe(false);
  });

  it('빈 토큰/형식 오류를 거부한다', () => {
    expect(verifyToken(undefined)).toBe(false);
    expect(verifyToken('')).toBe(false);
    expect(verifyToken('nodot')).toBe(false);
    expect(verifyToken('abc.def')).toBe(false);
  });

  it('비밀번호 비교는 정확히 일치할 때만 통과한다', () => {
    expect(passwordMatches('correct-horse', 'correct-horse')).toBe(true);
    expect(passwordMatches('correct-hors', 'correct-horse')).toBe(false);
    expect(passwordMatches('correct-horsee', 'correct-horse')).toBe(false);
    expect(passwordMatches('', 'correct-horse')).toBe(false);
    expect(passwordMatches(null, 'correct-horse')).toBe(false);
    expect(passwordMatches(123, 'correct-horse')).toBe(false);
  });
});
