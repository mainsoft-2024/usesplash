## Why

Payple 연동(코드 자체는 일부만 구현되었고 UI/라우터/cron은 미구현 상태)을 NICE Payments(나이스페이먼츠 for Startup)로 **완전 교체**하여 제품의 결제·구독 기능을 단일 PG 위에서 처음부터 끝까지 동작하도록 만든다. NICE는 한국 SaaS에서 표준에 가까운 PG이며, Server 승인 + Basic 인증 조합은 우리 서버사이드 state machine 흐름과 가장 잘 맞고, 빌링키 기반 정기결제·웹훅·취소·현금영수증을 단일 공급자에서 처리할 수 있어 운영 부담이 가장 낮다.

또한 기존 Prisma 스키마의 `paypleOrderId`, `payplePayId` 같은 PG-종속 필드명이 굳어지기 전에, 이번 교체와 함께 PG-중립(`orderId`, `providerPaymentId`)으로 리네임하여 향후 다른 PG로의 교체 가능성을 열어둔다.

## What Changes

- **BREAKING**: `src/lib/payple/**` 모듈 전체 제거.
- **BREAKING**: Prisma `Payment` / `Subscription` / `BillingKey` 모델의 PG-종속 필드를 PG-중립으로 리네임하는 마이그레이션 추가 (`paypleOrderId` → `orderId`, `payplePayId` → `providerPaymentId`, `payerId` → `billingKeyRef` 등). dev DB는 reset 가정.
- 신규 `src/lib/nicepay/**` 모듈 추가: HTTP 클라이언트(Basic 인증), Server 승인 모델 결제 승인 API, 취소 API, 거래 조회 API, 빌링키 발급/승인/만료 API, 현금영수증 발급/취소 API, signData 생성 유틸, 위변조/금액 검증 유틸, AES-256-CBC encData 암호화 유틸, mode(test/live) 라우팅.
- 신규 API Route Handlers (모두 Node 런타임):
  - `POST /api/payments/nicepay/return` — 결제창 returnUrl. 서명/금액 검증 후 `/v1/payments/{tid}` 호출하여 승인, DB 트랜잭션, 결과 페이지로 303 리다이렉트.
  - `POST /api/webhooks/nicepay` — 가상계좌 입금완료/만료, 결제 취소, 정기결제 자동청구 결과 수신 및 멱등 처리.
  - `GET /api/cron/billing` — 매일 KST 자정 실행, `nextBillingDate <= now()` 인 활성 구독에 빌링키 승인 호출. CRON_SECRET 가드.
- 기존 `src/lib/billing/state-machine.ts`는 PG-중립이므로 그대로 유지.
- `src/lib/billing/record-payment.ts`는 입출력 타입을 PG-중립(`ProviderPaymentResult`)으로 일반화하고 NICE 어댑터를 통해 호출되도록 수정.
- 신규 tRPC `paymentRouter`: `getPricing`, `createCheckoutSession` (orderId 발급+pending Payment 레코드 선생성), `requestBillingApproval` (사용자가 `즉시 청구` 시), `cancelSubscription`, `uncancelSubscription`, `listPayments`, `requestRefund` (admin), `expireBillingKey` (admin).
- 신규 UI:
  - `/pricing` 페이지 (월간/연간 토글, KRW VAT 포함 가격 표시, 약관/환불 정책 링크).
  - `/account/payments` 페이지 (결제 이력, 영수증 링크, 다음 청구일, 구독 취소/되살리기 버튼).
  - 대시보드 상단의 "Pro 업그레이드" CTA 컴포넌트.
  - NICE JS SDK(`https://pay.nicepay.co.kr/v1/js/`) 동적 로딩 컴포넌트.
- 환경변수 변경: `NICEPAY_MODE` (test|live), `NICEPAY_CLIENT_ID`, `NICEPAY_SECRET_KEY`, `NICEPAY_API_BASE`, `NICEPAY_JS_SDK_URL`, `PRICE_PRO_MONTH_KRW=19900`, `PRICE_PRO_YEAR_KRW=199000`. 기존 `PAYPLE_*` 변수 모두 제거. `NEXT_PUBLIC_PAYMENTS_ENABLED`는 유지하되 의미를 NICE 토글로 재정의.
- `next.config.ts` CSP에서 Payple 도메인 제거하고 NICE 도메인(`pay.nicepay.co.kr`, `api.nicepay.co.kr`, `start-pay.nicepay.co.kr`) 추가.
- 정책: 19,900원/월 또는 199,000원/년(2개월 할인), 무료체험 없음, 정기결제 실패 시 1·3·7일 자동재시도 + 7일 grace, 취소 시 기간 만료 시 free 강등, 환불 7일 + 사용량 0 조건, 정기결제 빌링키는 카드만, 가상계좌 등 일반결제 수단은 코드는 갖추되 UI 미노출.
- 기존 `openspec/changes/payple-payment-integration` 디렉토리는 archive로 이동 + README에 "Superseded by `nicepay-payment-integration`" 명시.

## Capabilities

### New Capabilities
- `payment-processing`: NICE Payments Server 승인 모델 + Basic 인증 기반 결제창 호출, 결제 승인, 취소, 거래 조회, 위변조/금액 검증, signData 생성, AES-256-CBC encData 암호화 등 PG 단건 결제 처리 책임.
- `recurring-billing`: NICE 빌링키 발급/승인/만료, Pro tier 월/연 정기결제 사이클 자동화, 일일 cron 청구, 실패 시 자동 재시도 정책(1·3·7일 + 7일 grace) 및 free 자동 강등.
- `payment-webhooks`: NICE 웹훅 수신(가상계좌 입금완료/만료, 결제 취소, 정기결제 결과), 멱등 처리, signData 검증, DB 비동기 동기화.
- `pricing-and-checkout-ui`: `/pricing` 페이지(월/연 토글, VAT 포함 표시), `/account/payments` 결제 이력·영수증·구독 관리 페이지, 대시보드 업그레이드 CTA, NICE JS SDK 통합.
- `payment-policy`: 가격(월 19,900 / 연 199,000), 환불(7일 + 사용량 0), 취소(기간 만료까지 사용), 무료체험 없음, 빌링키는 카드만, 현금영수증은 사용자가 결제창에서 선택 등 도메인 정책의 단일 출처.

### Modified Capabilities
- `subscription`: tier 전환 트리거를 record-payment(PG-중립) 경로로 일원화, `nextBillingDate` / `failedRetryCount` / `canceledAt` / `cancelReason` 필드의 라이프사이클을 NICE 정기결제 cron + webhook과 정합되도록 명시. PG 종속 필드명(`paypleOrderId` 등)을 PG-중립 명명으로 리네임.

## Impact

- **Code 제거**: `src/lib/payple/**` 전체, Payple 관련 테스트 전체, `next.config.ts`의 Payple CSP 항목, `.env.example`의 `PAYPLE_*` 항목.
- **Code 추가**: `src/lib/nicepay/**`, `src/app/api/payments/nicepay/return/route.ts`, `src/app/api/webhooks/nicepay/route.ts`, `src/app/api/cron/billing/route.ts`, `src/server/routers/payment.ts`, `src/components/pricing/*`, `src/components/checkout/*`, `src/app/pricing/page.tsx`, `src/app/account/payments/page.tsx`.
- **Code 수정**: `prisma/schema.prisma`(필드 리네임 + NICE 전용 보조 필드), `src/lib/billing/record-payment.ts`(PG-중립 입력), `src/server/routers/_app.ts`(payment 라우터 등록), `src/server/routers/subscription.ts`(가격/주기 조회 추가), `next.config.ts`(CSP), `.env.example`.
- **데이터베이스**: Prisma 마이그레이션 1건. dev DB reset 전제로 진행. 운영 데이터 없음 가정 (있다면 데이터 보존 마이그레이션으로 전환 필요 — 별도 게이트).
- **외부 의존성 신규**: NICE Payments 가맹점 계약, `clientId`/`secretKey` 발급, NICE 관리자 콘솔에서 webhook URL 등록 + Vercel 환경변수 설정.
- **보안**: `NICEPAY_SECRET_KEY`는 서버 전용. 카드정보(PAN/유효기간/생년월일/비밀번호 앞2자리)는 절대 우리 DB에 저장 금지. NICE에서 받은 `bid`(billing key)와 마스킹된 카드번호·브랜드만 저장.
- **컴플라이언스**: 약관/개인정보처리방침/환불정책 페이지 갱신 필요(별도 작업, 본 change에서는 링크만 노출).
- **운영**: Vercel cron 등록(`/api/cron/billing` 매일 00:10 KST), NICE 콘솔 webhook URL 등록.
- **리스크**: returnUrl/webhook은 NICE 서버에서 form-urlencoded POST로 옴 → CSRF 미들웨어 우회 필요(서명·금액 검증으로 대체). orderId 재사용 금지 → DB 유니크 제약 + 사전 pending 레코드 패턴으로 보호.
