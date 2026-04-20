import { describe, it, expect } from 'vitest';
import { generatePrompts } from '@/utils/promptGenerator';

describe('promptGenerator', () => {
  it('should generate an array of long-tail search prompts based on region and treatment', () => {
    const region = '강남역';
    const treatment = '임플란트';
    
    const prompts = generatePrompts(region, treatment);
    
    // 최소 5개 이상의 프롬프트가 생성되는지 확인
    expect(prompts.length).toBeGreaterThanOrEqual(5);
    
    // 특정 키워드들이 프롬프트 문장에 포함되어 있는지 샘플 검증
    expect(prompts[0]).toContain(region);
    expect(prompts[0]).toContain(treatment);
    
    // 프롬프트 문구들이 유효한 문자열인지 확인
    prompts.forEach(prompt => {
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(10); // 의미있는 문장 길이 판단
    });
  });

  it('handles empty parameters gracefully', () => {
    const prompts = generatePrompts('', '');
    expect(prompts.length).toBeGreaterThan(0); // 빈 값이어도 기본 배열 형태는 반환해야 함
  });
});
