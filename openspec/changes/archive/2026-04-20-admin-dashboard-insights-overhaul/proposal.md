## Why

The current admin dashboard shows basic usage metrics (user count, generation count, daily generations) but gives zero visibility into **unit economics**. As an AI SaaS, we pay per Gemini image, per OpenRouter token, and per GB of Blob storage — yet we can't see what we're spending, what we're earning, or whether each user is profitable. Operators/CEO need a single pane showing cost vs. revenue, funnel health, retention, and abuse signals to make pricing and product decisions with actual numbers.

## What Changes

### Data layer
- **UsageLog schema extension**: add `model`, `imageCount`, `imageCostUsd`, `llmInputTokens`, `llmOutputTokens`, `llmCostUsd`, `blobBytes`, `blobCostUsd` (all nullable for back-compat)
- **New `lib/pricing.ts`**: single source of truth for Gemini image unit price ($0.134 @ 1K/2K), OpenRouter token prices ($0.50/M in, $3.00/M out for `google/gemini-3-flash-preview`), Vercel Blob $/GB-month, and plan MRR prices (`pro=$10`, `demo=$0`, `enterprise=$100`, `free=$0` — temporary placeholder numbers)
- **Cost recording at insert time**: `generateLogoImage` / `editLogoImage` return sites and chat route `onFinish` populate cost fields on UsageLog using `pricing.ts` + AI SDK `usage` object + uploaded image byte size
- **Backfill script**: `scripts/backfill-usage-costs.ts` fills historical UsageLog rows using `count × current unit price` for best-effort estimation

### Admin dashboard UX overhaul (13 improvements)
Tab-based layout (`개요 / 비용 / 수익 / 사용자 / 자료`), 30-day default with 7 / 30 / 90 / 전체 range selector, Recharts retained (custom widgets only where needed), admin-role-only access.

1. **누적 API 비용 차트** — Gemini + OpenRouter 일/주/월 스택 에어리어
2. **MRR 대시보드** — 현재 MRR, MoM 성장률, ARR, 활성 유료 구독자 수
3. **총마진 & 번레이트 카드** — `수익 − 비용 = 마진`, 월 번레이트 러닝 계산
4. **사용자별 비용/수익 랭킹 테이블** — top spenders, top cost users, 마진 랭킹
5. **활성화 퍼널** — `User.createdAt → 첫 Project → 첫 UsageLog → 첫 Pro Subscription` 전환율
6. **주별 가입 코호트 × W0~W7 리텐션 히트맵**
7. **시간대(0~23) × 요일(월~일) 사용량 히트맵**
8. **레이트리미트/에러 야사경 패널** — Gemini 429 비율, 에러율, 재시도 횟수 (JSON stdout 로그 파싱)
9. **최근 활동 실시간(ish) 피드** — 무한스크롤 이벤트 타임라인, 수동 새로고침
10. **인기 스타일/키워드 막대차트** — `Logo.prompt` 해시태그/키워드 사전 기반 집계
11. **생성물 샘플 갤러리** — 최근 24개 LogoVersion 썸네일 모자이크
12. **사용자 검색/필터 강화** — tier, 활성도, 가입일 기간 필터 + CSV 내보내기
13. **알림/임계값 배너** — 대시보드 상단 경고 배너 (마진 <70%, 이번달 비용 급증, 에러율 ↑)

### User detail page (`/admin/users/[id]`) 확장
- LTV, 누적 구독금액, 누적 API 비용, 단일 사용자 마진 패널 추가

### Out of scope (이번 변경에서 제외)
- Stripe 실 결제 연동 (MRR은 `Subscription` 테이블 추정)
- SSE/WebSocket 실시간 스트리밍 (수동 새로고침)
- 이메일 알림 시스템 (대시보드 표시만)
- 다국어 i18n (한국어만)

## Capabilities

### New Capabilities
- `admin-cost-tracking`: API 비용(Gemini 이미지 + OpenRouter 토큰 + Blob 바이트) 를 UsageLog에 이벤트 단위로 기록하고 집계하는 능력. pricing.ts 단가 테이블, 백필 스크립트 포함.
- `admin-revenue-analytics`: Subscription 테이블 기준 MRR/ARR/churn 추정, 플랜 단가 상수, 총마진·번레이트 계산, 사용자별 LTV 계산.
- `admin-dashboard-insights`: 탭 기반 어드민 UX (개요/비용/수익/사용자/자료), 13개 인사이트 위젯 (누적 비용 차트, MRR 카드, 마진 카드, 랭킹 테이블, 퍼널, 코호트 히트맵, 시간대 히트맵, 레이트리미트 패널, 활동 피드, 키워드 차트, 샘플 갤러리, 검색·필터·CSV, 임계값 배너).

### Modified Capabilities
- `usage-tracking`: UsageLog 스키마에 cost·token·byte 필드 추가, 생성·수정 시점 cost 기록 의무화.
- `admin-user-management`: 사용자 목록에 비용·수익·마진 컬럼, 상세 페이지에 LTV·누적비용·마진 패널 추가, 필터/CSV 강화.

## Impact

- **Database**: `UsageLog` 테이블에 8개 nullable 컬럼 추가, 마이그레이션 1건
- **Backfill**: `scripts/backfill-usage-costs.ts` 1회성 실행
- **New files**: `web/src/lib/pricing.ts`, `web/src/server/routers/admin-insights.ts` (또는 기존 admin.ts 확장), 다수 위젯 컴포넌트 under `web/src/components/admin/`
- **Modified**: `web/src/lib/gemini.ts` (cost return), `web/src/app/api/chat/route.ts` (UsageLog insert payload), `web/src/app/admin/page.tsx` (탭 레이아웃으로 재구성), `web/src/app/admin/users/[id]/page.tsx` (수익/비용 패널)
- **Dependencies**: 기존 recharts 그대로. 신규 패키지 없음.
- **Config**: `.env`에 plan price는 두지 않음 (`pricing.ts` 상수). Gemini 이미지 단가도 상수.
- **Permissions**: 기존 `adminProcedure` 가드 재사용. 화이트리스트 이메일 변경 없음.
