import { describe, it, expect } from 'vitest';
import { runMockAnalysis } from '@/utils/analyzeMock';

describe('runMockAnalysis (Task 4 & 5 Mock Logic)', () => {
  it('should return simulated SOV data for a given clinic', async () => {
    const clinicName = '우리치과';
    
    // 모의 분석 실행 (Promise 형태로 반환 예정)
    const result = await runMockAnalysis({ clinicName, region: '강남역', treatment: '임플란트' });
    
    // 반환된 데이터 구조가 정확한지 TDD로 검증
    expect(result).toHaveProperty('totalSearches');
    expect(result).toHaveProperty('clinicMentions');
    expect(result).toHaveProperty('sovPercentage');
    expect(result).toHaveProperty('details');
    
    // 상세 엔진별 데이터 확인
    expect(result.details).toHaveProperty('chatgpt');
    expect(result.details).toHaveProperty('gemini');
    
    // 퍼센트 계산식 논리 검증 (소수점 이내가 맞는지)
    expect(result.sovPercentage).toBeGreaterThanOrEqual(0);
    expect(result.sovPercentage).toBeLessThanOrEqual(100);
  });
});
