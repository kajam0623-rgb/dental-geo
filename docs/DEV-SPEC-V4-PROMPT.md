# 닥터원츠 GEO 스캐너 V4 업그레이드 — 기술개발서 프롬프트

> 이 문서 전체를 AI 코딩 에이전트에게 그대로 전달하면 된다.
> 작성일 2026-08-11. 모든 버그는 실행 또는 코드 추적으로 확인된 실재 결함이다.

---

## 역할

너는 시니어 풀스택 개발자다. 아래 명세를 순서대로 구현한다.
각 Phase의 **검증 기준을 실행으로 통과시키기 전에는 다음 Phase로 넘어가지 않는다.**
"됐다"는 보고는 반드시 실행 증거(테스트 출력, API 응답 원문)와 함께 한다.
테스트 통과·빌드 성공은 "안 깨졌다"는 뜻이지 "기능이 동작한다"는 뜻이 아니다 — 기능은 실제 데이터로 확인한다.

## 프로젝트 컨텍스트

- **제품**: 치과 AI 검색 점유율(SOV) 스캐너. 마케팅 대행사가 치과 원장에게 "AI 검색에서 귀원이 얼마나 노출되는가"를 리포트로 보여주는 도구. **숫자의 신뢰성이 제품의 전부다.**
- **작업 폴더**: `C:\Users\닥터원츠\dental-geo`, 브랜치 `upgrade/v4` (main 건드리지 말 것)
- **스택**: Next.js 16.2.3 (App Router, Turbopack), React 19, TypeScript, Tailwind 4, Vercel 배포, Vercel KV(Upstash), vitest+RTL
- **원리**: 환자가 물을 법한 프롬프트를 ChatGPT·Gemini에 N회 질의 → 응답 원문에서 치과명 탐지 → SOV·순위·경쟁사 집계
- **핵심 설계 규칙**: 응답을 받은 건수만 SOV 분모로 삼는다. 오류·타임아웃은 `ok: false`로 분리해 분모에서 제외하고 UI에 ⚠로 표시한다. **'응답 실패'와 '노출 안 됨'을 절대 합치지 않는다.** (합치면 API 장애 시 "이 치과는 AI에 안 뜬다"는 정반대 결론의 허위 리포트가 나간다)

## 이미 완료된 것 (건드리지 말 것)

- `src/utils/ranking.ts` — V2에서 이식된 순수 함수 모음 (normalizeText, nameVariants, canonicalKey, isMentioned, extractRankedClinics, findPosition, rankCompetitors, averagePosition, findWeakKeywords). 실제 AI 응답으로 동작 검증 완료.
- `src/types/ranking.ts` — 위 함수들의 타입.
- `__tests__/ranking.test.ts`, `__tests__/isMentioned.test.ts` — 32개 테스트 전부 통과 중.
- `.env.local`에 GEMINI_API_KEY / OPENAI_API_KEY / AMPLITUDE_API_KEY + KV 키 세팅됨.

## 검증된 사실 (2026-08-11 실측 — 재조사 불필요)

- Gemini 현행: `@google/genai` v2 SDK + `gemini-3.5-flash` + `config: { tools: [{ googleSearch: {} }] }`. 단일 호출 6~7초.
- 구 SDK `@google/generative-ai`는 2025-11-30 EOL. 아직 동작은 하지만 교체 대상.
- OpenAI 현행: `openai` v7 SDK + `gpt-5.4-mini` + `responses.create({ tools: [{ type: 'web_search' }] })`. `web_search_preview`는 레거시.
- **OpenAI 계정 크레딧 0** (`credit_balance_exhausted`). 충전 전까지 ChatGPT 실호출 검증 불가 — 코드만 맞춰두고 `[크레딧 충전 후 검증 필요]`로 명시 보고할 것.

## 작업 환경 함정 (시간 낭비 방지)

1. `vitest.config.ts`가 jsdom 전역 — **OpenAI SDK는 jsdom에서 브라우저 감지로 거부한다.** 실 API 테스트는 파일 상단 주석 `// @vitest-environment node` 로 node 환경 지정.
2. 터미널에서 curl로 한글 JSON을 인라인 전달하면 깨진다. body를 node로 UTF-8 파일에 쓰고 `--data-binary @file`로 보낼 것. 깨진 한글은 매칭 실패 → 가짜 SOV 0%로 보인다.
3. 헤드리스 브라우저 패널은 `document.hidden=true`라 requestAnimationFrame 0프레임 — framer-motion `AnimatePresence mode="wait"` exit 콜백이 안 와서 결과 화면이 영영 안 뜬다. **앱 버그 아니다.** UI 검증은 브라우저 대신 RTL DOM 테스트로 할 것.
4. SOV가 0% 또는 100%로 나오면 집계를 믿지 말고 응답 원문을 직접 읽어라. (0% 원인 후보: 모델 은퇴, 키 없음, 인코딩 깨짐, 접미사 미탐)

---

# Phase 1 — 측정 정확도 (허위 리포트 제거)

### 1-1. SDK·모델 현행화
- `npm i @google/genai@^2.16.0 openai@^7.4.0` 후 `npm rm @google/generative-ai`
- `src/utils/analyze.ts`의 `queryGemini`/`queryChatGPT`를 위 "검증된 사실"의 현행 구성으로 교체. 모델 ID는 파일 상단 상수로:
  ```ts
  const GEMINI_MODEL = 'gemini-3.5-flash';
  const OPENAI_MODEL = 'gpt-5.4-mini';
  ```
- `src/app/api/generate-prompts/route.ts`도 같은 구 SDK 사용 중 — 함께 교체.
- **검증**: node 환경 실호출 프로브에서 Gemini 정상 응답 + 치과명 3개 이상 추출. ChatGPT는 크레딧 확인 후.

### 1-2. `ok` 플래그 — 오류/타임아웃 분모 제외
확인된 버그: ChatGPT 3건 전부 `[오류]`인데 집계가 `{"sov":0,"mentions":0,"total":3}` — 오류가 '미노출'로 둔갑.
- `QueryResult`에 `ok: boolean` 추가. 오류·타임아웃·빈 응답 = `ok: false`.
- `runAnalysisV3` 집계에서 분모를 `ok=true` 건수로. `V3AnalysisResult.summary`에 엔진별 `answered`, `failed` 추가.
- V3Dashboard: `failed > 0`이면 호박색 배너 "{n}건의 질의가 응답을 받지 못했습니다 (API 오류/타임아웃). 점유율 계산에서 제외했습니다."
- **검증**: 오류 응답을 섞은 입력에서 SOV 분모가 answered로 계산되는 단위 테스트 + 배너 렌더링 RTL 테스트.

### 1-3. 접미사 변형 매칭 (최우선 버그)
실측 확인: 풀네임 `하루플란트치과의원`·단축명 비움 → Gemini가 3/3회 `하루플란트치과`를 **1위로 추천**했는데 집계는 `mentions: 0, sov: 0%`.
- `analyze.ts`의 자체 `isMentioned`/`isMentionedAny`/`normalizeText`를 삭제하고 `@/utils/ranking`의 `isMentioned` 사용 (nameVariants가 의원/병원 접미사 변형을 커버).
- **검증**: 위 실측 시나리오 재현 실호출 — 단축명 비운 채 스캔해서 mentions ≥ 1 나와야 통과.

### 1-4. 경쟁사 집계 canonicalKey 통일
실측 확인: `유씨강남치과(UC강남치과)`/`유씨강남치과`/`UC강남치과` 3분열, 똑똑플란트·고르다 2분열.
- `analyze.ts`의 `extractCompetitors` 삭제, `ranking.ts`의 `rankCompetitors`(canonicalKey 집계, 가장 완전한 표기를 대표명으로)로 교체.
- `CompetitorRank` 타입을 `{ name, mentions, exposureRate, avgPosition }`로 통일 (기존 `count/percentage`와의 호환은 Phase 2 스키마 마이그레이션에서 처리).
- **검증**: 혼재 표기 픽스처가 1건으로 합쳐지는 단위 테스트 + 실호출 결과에서 분열 없음 육안 확인.

### 1-5. 순위·취약 키워드를 보고서에 연결
- 각 응답에 `findPosition` 적용 → 프롬프트별 평균 노출 순위를 V3Dashboard 요약 카드와 상세 테이블에 표시 ("노출 3/3회 · 평균 1.0위").
- `findWeakKeywords` 결과를 AI 콘텐츠 전략 보고서 상단에 연결: 미노출/4위 밖 키워드 + 그 자리를 차지한 경쟁 치과 목록.
- **검증**: RTL 테스트 — 순위 표시, 취약 키워드 섹션 렌더링.

# Phase 2 — 저장 계층 재설계

### 2-1. KV 스키마: 단일 키 → 치과별 키
확인된 문제: 전 데이터가 `geo-clinics-v2` 한 키에 read-modify-write → 동시 저장 시 유실 + 값 크기 한계.
```
geo:index                  → string[] (canonicalKey 목록)
geo:clinic:<canonicalKey>  → ClinicRecord (원문 제외 메타 + 스캔 요약 최대 50개)
geo:texts:<scanId>         → 응답 원문 (엔진별·프롬프트별)
```
- 모든 레코드에 `schemaVersion: 2` 필드. GET 시 구버전(`geo-clinics-v2`) 감지하면 1회 마이그레이션 후 새 키로 저장.
- 확인된 버그: 저장 시 `responseTexts` 폐기 → 저장 스캔 열면 "ChatGPT 응답 (0회)". 원문을 `geo:texts:<scanId>`에 저장하고 보기 시 로드.
- **검증**: 실 KV로 저장→조회→원문 로드→삭제 왕복 스크립트. 동시 저장 2건 모두 생존 확인. 구버전 데이터 마이그레이션 확인 (prod KV에 기존 데이터 있는 경우).

### 2-2. 추이 히스토리 localStorage → KV
- `historyStorage.ts`의 localStorage 저장을 `geo:clinic:*` 스캔 기록 기반으로 대체 (스캔 요약에 이미 SOV가 있으므로 별도 저장 불필요 — 파생).
- **확인된 버그 함께 수정**: `page.tsx:32-45`의 `useEffect[result]`가 저장 스캔 '보기'에도 발화해 ① 볼 때마다 히스토리 중복 추가 ② `handleViewScan`이 만든 히스토리를 덮어씀. → 히스토리 기록은 **스캔 완료 시점에만** 명시 호출로 변경, effect 제거.
- **검증**: RTL — 저장 스캔 3회 열람 후 히스토리 레코드 수 불변. 실 KV — 다른 세션에서 조회 시 추이 보임.

# Phase 3 — 안정성·보안

### 3-1. 인증 강화
확인된 문제: 쿠키 값 = 비밀번호 원문, 브루트포스 제한 없음, 타이밍 세이프 비교 아님.
- 쿠키를 HMAC 서명 토큰으로: `sha256(ACCESS_PASSWORD + AUTH_SECRET)` 또는 서명된 만료 포함 토큰. `AUTH_SECRET` 환경변수 추가.
- `crypto.timingSafeEqual` 비교. `/api/auth`에 간단한 rate limit (IP당 분당 5회, KV 카운터).
- **검증**: 올바른/틀린 비번 각각 실호출. 옛 쿠키(비번 원문)로 접근 시 거부 확인.

### 3-2. 세션 만료 UX
확인된 버그: middleware가 `/api/*`도 login으로 redirect → 만료 후 스캔하면 fetch가 HTML 받고 JSON 파싱 실패 → "서버와 통신할 수 없습니다"라는 엉뚱한 에러.
- middleware에서 `/api/*`는 redirect 대신 `401 JSON` 반환. 클라이언트 fetch 래퍼가 401이면 "세션이 만료되었습니다" 알림 후 `/login` 이동.
- **검증**: 쿠키 삭제 상태로 스캔 시도 → 올바른 안내 확인 (RTL 또는 실서버 curl).

### 3-3. 죽은 라우트 제거 + 재시도 정책
- UI에서 안 쓰는 legacy `/api/search`, `/api/deep-scan` 라우트와 `analyze.ts`의 legacy 함수 삭제 (V1 잔재. 순차+2초 sleep 구조라 maxDuration 초과 위험, `repeatCount=0`이면 NaN).
- OpenAI 클라이언트 `maxRetries: 0` — 크레딧 소진·쿼터 오류(4xx)에 기본 2회 재시도로 시간 낭비하는 것 방지. 5xx만 1회 재시도.
- KV 장애 시 조용한 실패 금지 — 저장 실패를 사용자에게 알림.
- storage route에 입력 검증 (clinicFullName 존재, 문자열 길이 제한).
- **검증**: 삭제 후 빌드 성공 + 라우트 404 확인. 잘못된 키로 스캔 시 25초 안에 ⚠ 결과 반환.

# Phase 4 — 편의성

### 4-1. 프롬프트 편집 버그 (DOM 실측 확인)
`saveEdit`이 `text`만 갱신, `displayText` 미갱신 → 수정해도 화면은 옛 텍스트 (스캔은 새 텍스트로 나가는 이중 상태).
- `saveEdit`에서 `displayText`도 갱신. 편집 UI에는 SUFFIX 제외한 `displayText`를 보여주고 저장 시 `text = displayText + SUFFIX` 재조립.
- 직접 추가 프롬프트에도 SUFFIX 부착 (`addPrompt` 현재 누락 — 커스텀만 장문 응답이 와서 순위 추출 저하).
- **검증**: RTL — 수정 저장 후 새 텍스트 표시 + `onStart`로 전달되는 `text`에 SUFFIX 포함.

### 4-2. 실제 진행률 (SSE)
현재 가짜 순환 문구. `/api/analyze-v3`를 SSE 스트리밍으로: 프롬프트 1개 완료마다 `{done, total}` 이벤트, 마지막에 결과 JSON.
- 클라이언트: "3/10 프롬프트 완료 · 경과 42초" 실측 표시. 실패 시 부분 결과라도 반환.
- **검증**: 실스캔에서 진행 숫자 증가 확인 (curl로 SSE 스트림 직접 관찰 가능).

### 4-3. 사전 안내 + 비교
- 스캔 시작 버튼 옆에 예상 소요시간 표시 (호출수 × 실측 평균 7초 ÷ 동시성).
- 결과 화면에 직전 스캔 대비 SOV 델타 (▲5.2%p) 표시 — 저장 기록에서 파생.
- **검증**: RTL 렌더링 테스트.

# Phase 5 — 성능·정리

- 이미지 저장 라이브러리 3개(`html2canvas`, `html-to-image`, `react-to-print`) → `html-to-image` 하나만 남기고 제거.
- eslint 9 errors 해소 (미사용 import, `@ts-ignore`→`@ts-expect-error`, 따옴표 이스케이프, effect 내 setState).
- `layout.tsx` `lang="en"` → `"ko"`.
- `ScanSettings` 타입 `3|5|10|20` → UI와 일치하는 `3|5|10`.
- 엔진 일치율 재정의: 현재 "양쪽 다 미노출"도 일치로 집계 → 양쪽 0%인데 일치율 100%로 표시되는 역설. "양쪽 모두 노출"만 일치로 계산하고 라벨을 "동시 노출률"로.
- 동시성 실측 재조정: 현재 프롬프트 3 × 엔진별 5. rate limit 안 걸리는 선에서 상향 시도, 전후 소요시간 비교 기록.
- **검증**: `npx eslint src __tests__` 0 errors, `npm run build` 성공, 스캔 소요시간 before/after 수치 보고.

---

## 전역 완료 기준

1. `npx tsc --noEmit` 0 에러
2. `npm test` 전부 통과 (기존 32개 + 신규)
3. `npm run build` 성공
4. `npx eslint src __tests__` 0 에러
5. **실스캔 시나리오**: 풀네임만 입력(단축명 비움) → Gemini 실호출 → SOV·순위·경쟁사 랭킹이 응답 원문과 일치함을 원문 대조로 확인
6. 저장→새로고침→열람 → 원문·추이·순위 모두 복원
7. ChatGPT 축은 크레딧 충전 전이면 `[미검증]`으로 정직하게 보고

## 금지 사항

- main 브랜치 커밋·푸시·배포 (모든 작업은 `upgrade/v4`)
- 실행 증거 없는 "완료" 보고
- '응답 실패'와 '노출 안 됨' 합산
- 요청 범위 밖 리팩터링·스타일 변경 (기존 하우스 그린 디자인 유지)
- `.env.local` 커밋 (이미 gitignore, 확인만)
