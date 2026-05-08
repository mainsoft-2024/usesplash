## Context

- 제품: Splash (Next.js 15 App Router + tRPC v11 + Prisma 7 + Neon Postgres + NextAuth v5 + Vercel).
- 현재 결제 모듈: `src/lib/payple/**`(client/domestic/global/verify/order-id/currency/types/errors)와 `src/lib/billing/state-machine.ts` + `record-payment.ts`만 일부 존재. UI/라우터/cron/webhook은 미구현.
- 결제·구독 정책 결정사항(별도 인터뷰 결과): Pro 19,900원/월 또는 199,000원/년, 무료체험 없음, 정기결제 실패 시 1·3·7일 자동재시도 + 7일 grace, 취소 시 기간 만료까지 사용, 환불 7일 + 사용량 0, 빌링키는 카드만, 가상계좌·간편결제는 코드만 갖추고 UI 미노출.
- PG 결정사항: NICE Payments(나이스페이먼츠 for Startup), **Server 승인 모델**, **Basic 인증**, sandbox/live는 환경변수 분리.
- 외부 환경: NICE 결제창은 form POST로 returnUrl/webhook을 호출 → Next.js Route Handler는 Node 런타임 필수. CSRF 미들웨어 우회는 서명/금액 검증으로 대체.
- 연구 자료: `.slash/workspace/research/integration-nicepay-nextjs-trpc.md`(엔드포인트, signData 규칙, 에러코드, 보안 가이드).

## Goals / Non-Goals

**Goals:**
- NICE Payments 단일 PG로 결제·구독·환불·웹훅·정기청구 전 흐름을 서버에서 검증/제어.
- 결제 처리 코어를 PG-중립 인터페이스(`ProviderPaymentResult`)로 일반화하여 향후 PG 교체 비용 최소화.
- 위변조·이중과금·orderId 재사용을 DB 유니크 제약 + 서명/금액 사전검증으로 차단.
- NICE 빌링키와 cron을 결합하여 Pro 정기결제를 자동화하고, 실패 시 dunning 메일 + 자동 재시도 + grace + 자동 강등을 한 흐름으로 처리.
- 결제 실패/지연/이중수신 등 운영 문제를 webhook 멱등 처리로 흡수.
- 카드정보(PAN/유효기간/생년월일/카드비밀번호)를 우리 DB에 절대 저장하지 않는다.

**Non-Goals:**
- 무료체험, 쿠폰, 친구초대, 부가 결제수단 UI, 글로벌(USD) 결제, 인앱결제 — 본 change 범위 외.
- 기존 운영 데이터 마이그레이션 — dev DB reset 전제. 운영 데이터가 발견되면 별도 change로 분리.
- Recraft/remove.bg 등 외부 SaaS 비용 정산 — 별도 change.

## Decisions

### D1. Server 승인 모델 (vs Client 승인)
- 채택: **Server 승인**. 결제창에서 인증만 받고 returnUrl로 가맹점 서버에 결과 전달 → 서버가 `POST /v1/payments/{tid}` 로 명시적 승인.
- 이유: 위변조 안전(승인 직전 amount/orderId 비교), DB 트랜잭션과 묶을 수 있어 이중과금 차단, 우리 state machine과 자연스럽게 정합. Client 승인은 사후 보정 로직이 추가됨.

### D2. Basic 인증 (vs Access Token)
- 채택: **Basic**. `Authorization: Basic base64(clientId:secretKey)`.
- 이유: 토큰 만료/갱신 인프라 불필요, 단일 NICE 계정 + 서버 전용 호출이라 보안 동등. SecretKey는 서버 전용.

### D3. PG-중립 데이터 모델로 리네임
- 채택: `paypleOrderId` → `orderId`(@unique), `payplePayId` → `providerPaymentId`, `payerId` → `billingKeyRef`, `paymentRegion` 제거(국내 전용으로 단순화). NICE 고유 식별자(`tid`)는 별도 `providerTransactionId` 컬럼으로 보관.
- 이유: 향후 PG 교체 시 데이터 모델 안정. dev DB reset 전제이므로 비용 최소.
- 대안(거부): 새 컬럼 추가 + 기존 nullable 유지 → 스키마 영구 지저분.

### D4. orderId 형식 + 사전 pending 레코드
- 형식: `splash_{userIdShort8}_{epochSeconds}_{rand4}` (영문/숫자/언더스코어, 64바이트 이내).
- `createCheckoutSession` 호출 시 서버가 orderId 발급 + `Payment(orderId, status='pending', amount, expectedTier, periodStart, periodEnd)` 레코드 선생성. NICE 결제창은 이 orderId로 호출.
- returnUrl 핸들러는 orderId로 pending 레코드 조회 → amount 일치 검증 → 승인 API 호출 → 단일 트랜잭션 안에서 `status='paid'`로 갱신.
- 이유: orderId 재사용 금지를 DB unique로 강제, 위변조 검증의 신뢰원천을 클라이언트 입력이 아닌 DB로 고정.

### D5. signData 검증 규칙
- 결제승인: `sha256(authToken + clientId + amount + ediDate + secretKey)` (NICE 응답값과 비교).
- 빌링키 발급: 요청 `signData = sha256(orderId + ediDate + secretKey)`.
- 빌링키 승인: `sha256(orderId + bid + ediDate + secretKey)`.
- 취소: `sha256(tid + ediDate + secretKey)`.
- 모든 비교는 timing-safe equal 사용. 검증 실패 → 4xx 응답 + 보안 로그.

### D6. encData 암호화 (빌링키 발급)
- 알고리즘: AES-256-CBC, KEY=`secretKey`(32B), IV=secretKey 앞 16자, Padding=PKCS5, 결과 Hex.
- 평문 형식: `cardNo=...&expYear=YY&expMonth=MM&idNo=...&cardPw=...`.
- 평문은 메모리에서만 다루고 즉시 `Buffer.fill(0)`로 폐기. 응답에 카드정보 echo 금지.

### D7. Webhook 멱등 + 비동기
- 처리 흐름: 1) 서명 검증 → 2) `WebhookEvent(eventId @unique)` 레코드 INSERT (이미 있으면 200 즉시반환) → 3) 페이로드별 핸들러 호출 → 4) 200 응답.
- 5초 이내 응답 보장 위해 무거운 작업(이메일 발송 등)은 BullMQ가 아닌 인라인이지만 짧게 유지. 더 무거워지면 별도 큐 도입(향후).
- 이유: NICE는 미응답 시 재시도. 멱등성이 운영 안정성의 핵심.

### D8. 정기결제 cron 흐름
- `/api/cron/billing`: Vercel cron (`0 15 * * *` UTC = 00:00 KST + 10분 grace).
- 쿼리: `WHERE billingState='active' AND nextBillingDate <= now()`. 인덱스: `(nextBillingDate, billingState)`.
- 각 구독에 대해: 1) Idempotent invoice 생성(unique on `(subscriptionId, periodStart)`), 2) NICE 빌링키 승인 호출, 3) `record-payment` 트랜잭션 → state 전이, 4) 실패 시 `failedRetryCount` 증가하고 `nextBillingDate`를 1·3·7일 뒤로 스케줄, 5) 3회 실패 시 `pending_retry → canceled_grace`(grace 7일), grace 만료 시 `expired` 전이 + email.
- 동시성: 단순 처리 가정(Vercel cron 단일 실행). 향후 분산 락 필요시 advisory lock 도입.

### D9. 취소 정책
- 사용자가 `cancelSubscription` 호출 → `billingState='canceled_grace'`, `cancelEffectiveAt=현재 periodEnd`, `nextBillingDate=null`(자동청구 중단).
- `uncancelSubscription`는 `cancelEffectiveAt` 이전이면 active 복귀.
- cron에서 `cancelEffectiveAt <= now()` 인 canceled_grace 구독은 free 강등.

### D10. 환불 정책 구현
- `requestRefund`(admin 또는 사용자 자기자신): 7일 이내 + 사용량 0 게이트 → NICE `cancel` 호출 → Payment.status='refunded', Subscription billingState='free' 즉시 전이, refund email 발송.
- 부분환불은 admin 전용. 사용자 셀프는 전액환불만.

### D11. 환경 분기
- `NICEPAY_MODE=test|live`만으로 분기. `NICEPAY_API_BASE`는 모드별 기본값(`https://api.nicepay.co.kr`)을 두되 override 가능. `NEXT_PUBLIC_PAYMENTS_ENABLED` 토글로 UI 노출 제어.
- 로컬·preview = test 강제, 프로덕션만 live 허용. `lib/nicepay/config.ts`에서 `NODE_ENV==='production' && VERCEL_ENV==='production'` 일 때만 live 허용 가드.

### D12. CSP / Route Handler 런타임
- next.config.ts에 NICE 도메인 추가: `pay.nicepay.co.kr`, `start-pay.nicepay.co.kr`, `api.nicepay.co.kr`(connect-src), `pay.nicepay.co.kr`(frame-src, script-src).
- 모든 결제 관련 Route Handler는 `export const runtime = 'nodejs'` 명시(crypto + Prisma 사용).
- returnUrl 핸들러는 form-urlencoded POST를 받음 → `request.formData()` 사용. CSRF 미들웨어 적용 시 이 라우트만 예외(서명·금액 검증으로 대체).

### D13. UI / SDK 로딩
- NICE JS SDK는 `next/script` 사용, `strategy="afterInteractive"`. `/pricing`과 `/account/payments`에서만 로딩. 전역 로딩 금지(번들·CSP 영향).
- 결제창은 모달이 아닌 NICE의 자체 팝업 — 모바일에서는 same-tab 리다이렉트 fallback. SDK 기본동작 사용.

### D14. PG-중립 record-payment 시그니처
```
type ProviderPaymentResult = {
  orderId: string;
  providerPaymentId: string;       // NICE: tid
  providerTransactionId?: string;   // NICE: tid 동일, 다른 PG에선 분리될 수 있음
  status: 'paid' | 'failed' | 'refunded' | 'pending_vbank';
  amount: number;
  currency: 'KRW';
  errorCode?: string;
  errorMessage?: string;
  receiptUrl?: string;
  paymentMethod: 'card' | 'vbank' | 'bank' | 'kakaopay' | 'naverpay' | 'easypay' | 'cellphone';
  paidAt?: Date;
};
```
- `record-payment.ts`는 이 인터페이스만 받음. NICE 어댑터(`src/lib/nicepay/adapter.ts`)가 NICE 응답을 이 형태로 매핑.

## Risks / Trade-offs

- [orderId 재사용 시 NICE 4xx] → `Payment.orderId` @unique + 사전 pending 레코드. 동일 사용자가 동일 플랜에 재시도하면 새 orderId 발급.
- [returnUrl 누락/네트워크 단절로 사용자 화면만 성공 표시] → cron + webhook이 백업 동기화. UI는 server-fetched DB 상태 기준 표시.
- [Webhook 도착 전 cron이 같은 invoice 처리] → invoice unique on `(subscriptionId, periodStart)` + Payment unique on `orderId` + state machine 멱등 처리.
- [SecretKey 유출] → 서버 전용. NEXT_PUBLIC_ prefix 금지. 코드 리뷰 시 `process.env.NICEPAY_SECRET_KEY` 사용 위치를 grep 가드 테스트로 차단(`tier-write-allowlist.test.ts`와 같은 패턴).
- [카드정보 일시 메모리 보관 중 누수] → encData 만든 직후 평문 버퍼 zeroize, 응답 echo 금지, 로깅 시 마스킹.
- [Vercel cron 5분 단위 → 정확한 자정 청구 불가] → 00:10 KST 1회 실행으로 충분. 일별 청구 정확도 요구 사항 없음.
- [NICE sandbox와 live 동작 차이] → mode 환경변수 + e2e 시나리오로 sandbox 검증, live는 카나리 1건 실결제 후 활성.
- [필드명 리네임이 운영 데이터에 영향] → dev DB reset 전제. 운영 데이터 발견 시 별도 maintenance change로 전환.
- [한글 인코딩 문제] → 모든 호출에 `returnCharSet=utf-8` 강제, returnUrl 응답 페이지도 UTF-8.
- [ENV 누락으로 빌드 시점에 발견 불가] → 서버 시작 시 zod로 env 검증, 누락이면 부팅 실패.

## Migration Plan

1. **DB 마이그레이션**: Prisma 스키마 리네임 적용, dev DB reset, prod DB는 운영 데이터 없음을 확인 후 동일 적용 (있으면 본 change 차단 + 별도 데이터 보존 마이그레이션).
2. **코드 swap**: `src/lib/payple/**` 제거 → `src/lib/nicepay/**` 추가 → `record-payment` 시그니처 일반화 → tRPC `paymentRouter` + 라우트 핸들러 + UI 신규 작성.
3. **CSP / ENV**: `next.config.ts` 갱신, `.env.example` 갱신, Vercel 환경변수 등록(test 먼저).
4. **NICE 콘솔 설정**: webhook URL 등록, returnUrl 등록(가능 시), test/live 키 발급 확인.
5. **검증 단계**:
   - sandbox에서 카드 결제(승인/실패) → 빌링키 발급 → 빌링키 승인 → 취소 → 환불 → 가상계좌 입금완료 webhook → 정기결제 cron 1회.
   - tier-write-allowlist 테스트 통과(record-payment / paymentRouter / cron만 Subscription.tier 쓰기 허용).
6. **카나리 live**: 내부 계정 1건 실결제(최소 금액으로 임시 테스트 플랜 또는 정상 19,900원) → 즉시 환불. 성공 시 `NEXT_PUBLIC_PAYMENTS_ENABLED=true` 토글.
7. **archive payple change**: `openspec/changes/payple-payment-integration/` → `openspec/changes/archive/`로 이동, README에 superseded 명시.

**Rollback:**
- DB 마이그레이션은 down 마이그레이션 작성. 코드 롤백은 git revert 1 커밋 단위로 분리.
- live 토글(`NEXT_PUBLIC_PAYMENTS_ENABLED=false`)로 UI만 비활성 가능 — 빠른 회피책.

## Open Questions

- NICE 콘솔에서 returnUrl 등록이 도메인 단위로 1개만 가능한지(여러 환경 필요시 와일드카드 또는 복수 등록 가능 여부) — 사용자가 키 발급 시 함께 확인.
- 영수증 페이지 URL을 NICE 응답의 `receiptUrl`을 그대로 노출 vs 자체 이메일/페이지로 감쌀지 — 1차는 NICE URL 그대로 사용.
- 약관/환불정책 페이지의 최종 카피 — 본 change에서는 placeholder 링크만 제공, 실제 카피는 별도 작업.
