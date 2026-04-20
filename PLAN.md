# Dental GEO Tracker V2 - Implementation Plan

## 1. 개요 (Overview)
기존 V2 대시보드에서 발생하는 **"통합 SOV 0%" 현상을 근본적으로 해결**하고, 고객(대행사)이 치과 원장님들에게 직관적으로 "왜 SEO 최적화가 필요한지"를 보여줄 수 있도록 **사용자 경험(UX) 및 AI 검색 신뢰성**을 대폭 강화합니다.

## 2. 해결해야 할 문제점 (Pain Points)
1. **분석 API 타임오버**: 6초(6000ms)의 짧은 제한 시간으로 인해 LLM(Gemini / ChatGPT)의 답변이 완성되기도 전에 연결이 끊겨 모두 '노출 안 됨(false)' 처리됨.
2. **블랙박스 결과 반환**: UI 상에서 "O, X" 로만 표기되어 실제 AI가 다른 경쟁 병원을 추천했는지 알 수 없음.
3. **프롬프트 단조로움**: 타겟을 너무 한정 지어 AI가 답변하기 까다로울 수 있음.

## 3. 세부 구현 목표 (Action Items)

### ✅ [Task 1] 타임아웃 오류 수정 및 안정화 — DONE
- **파일**: `src/utils/analyze.ts`
- **구현 내용**:
  - `withTimeout` 함수의 대기 시간을 기존 6000ms에서 **30000ms(30초)**으로 대폭 늘림.
  - TIMEOUT_MS 상수로 분리하여 가독성 향상.
  - 타임아웃 시 응답 텍스트에 '[타임아웃] 응답 시간이 초과되었습니다.' 표시.

### ✅ [Task 2] AI 실제 출력 원문 저장 및 UI 표출 로직 작성 (UX 고도화) — DONE
- **파일**: `src/utils/analyze.ts` & `src/utils/analyzeMock.ts` (타입 정의)
- **구현 내용**:
  - `KeywordDetail` 인터페이스에 `chatgptResponseText`, `geminiResponseText` 필드 추가.
  - `queryGemini`, `queryChatGPT` 함수가 `QueryResult { mentioned: boolean, responseText: string }` 반환하도록 변경.
  - Mock 분석에도 리얼한 경쟁 병원 추천 텍스트 생성 로직 포함.

### ✅ [Task 3] 프론트엔드 모달/툴팁 구현 (결과 상세 보기) — DONE
- **파일**: `src/components/ResponseModal.tsx` (신규), `src/components/DashboardResult.tsx`
- **구현 내용**:
  - 새로운 `ResponseModal` 컴포넌트 생성 (glassmorphism 스타일, Framer Motion 애니메이션).
  - O/X 아이콘을 클릭 가능한 버튼으로 변환, 클릭 시 모달 팝업.
  - 모달에서 검색 프롬프트 + AI 응답 원문 + 노출 여부 표시.
  - ESC 키 / 배경 클릭으로 닫기 지원.
  - **bold** 마크다운 텍스트 하이라이팅.

### ✅ [Task 4] 프롬프트 튜닝 (Prompt Generator 강화) — DONE
- **파일**: `src/utils/promptGenerator.ts`
- **구현 내용**:
  - 모든 프롬프트 끝에 "답변 시 반드시 실제로 존재하는 특정 병원(치과)의 이름을 3~5개 추천 리스트로 나열해 주세요." suffix 추가.
  - AI가 확정적으로 병원명을 나열하도록 유도.

## 4. 예상 결과 및 검증 (Gap Analysis용)
이 플랜이 완료되면,
1. 타임아웃이 나지 않으므로 SOV가 0%가 아닌, 실제 인지도에 맞는 실제적인 %가 출력됩니다.
2. 유저가 스캐닝 결과의 X 마크를 눌러 **경쟁사가 추천된 원문 텍스트를 바로 확인**하여 높은 신뢰도를 확보할 수 있습니다.
