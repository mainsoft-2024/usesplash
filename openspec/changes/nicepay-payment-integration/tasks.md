## 1. Foundation cleanup & env

- [x] 1.1 Remove `src/lib/payple/**` (client, domestic, global, verify, order-id, currency, types, errors) and all associated tests.
- [x] 1.2 Remove Payple CSP entries in `next.config.ts` and replace with NICE domains (`pay.nicepay.co.kr`, `start-pay.nicepay.co.kr`, `api.nicepay.co.kr`).
- [x] 1.3 Update `.env.example`: remove all `PAYPLE_*` keys; add `NICEPAY_MODE`, `NICEPAY_CLIENT_ID`, `NICEPAY_SECRET_KEY`, `NICEPAY_API_BASE`, `NICEPAY_JS_SDK_URL`, `PRICE_PRO_MONTH_KRW=19900`, `PRICE_PRO_YEAR_KRW=199000`, `CRON_SECRET`. Document each.
- [x] 1.4 Add zod-validated env loader at `src/lib/env.ts` (or extend existing) with live-mode guard (`NICEPAY_MODE='live'` requires `VERCEL_ENV='production'`); fail boot on missing vars.
- [x] 1.5 Move `openspec/changes/payple-payment-integration/` → `openspec/changes/archive/payple-payment-integration/` and add `archive-note.md` stating "Superseded by nicepay-payment-integration".

## 2. Database schema (PG-neutral rename + NICE additions)

- [x] 2.1 Create Prisma migration that renames `Payment.paypleOrderId → orderId`, `Payment.payplePayId → providerPaymentId`, adds `Payment.providerTransactionId`, drops `Payment.paymentRegion`. Keep `@unique` on `orderId`.
- [x] 2.2 Rename `BillingKey.payerId → bid`, add `BillingKey.cardBrand`, `BillingKey.last4`, drop `BillingKey.cardNum` (keep masked `last4` only).
- [x] 2.3 On `Subscription` rename PG-prefixed fields to PG-neutral, add `activeBillingKeyId` FK, `cancelEffectiveAt`, `billingState` enum (`free|active|pending_retry|canceled_grace|expired`), keep `currency='KRW'`.
- [x] 2.4 Add new `WebhookEvent { id, eventId @unique, type, payload Json, signatureValid, receivedAt, processedAt, processingError }` model with index on `receivedAt`.
- [x] 2.5 Add new `AuditLog { id, actorId, targetUserId, action, payload Json, createdAt }` model with indexes on `(targetUserId, createdAt)`.
- [x] 2.6 Add new `Invoice { id, subscriptionId, periodStart, periodEnd, amount, currency, status, paymentId? }` with `@@unique([subscriptionId, periodStart])`.
- [x] 2.7 Run `prisma migrate dev` against dev DB, verify generated types compile.

## 3. NICE Payments core library (`src/lib/nicepay/**`)

- [x] 3.1 `config.ts`: read env, expose `apiBase`, `clientId`, `secretKey`, `jsSdkUrl`, `mode`. Add live-mode guard.
- [x] 3.2 `auth.ts`: `getBasicAuthHeader()` returning `Basic base64(clientId:secretKey)`.
- [x] 3.3 `signature.ts`: pure functions `signApprove`, `signBilling`, `signBillingApprove`, `signCancel`, `signWebhook` using sha256 with the formulas in design.md §D5; include `timingSafeEqual` helper.
- [x] 3.4 `crypto.ts`: AES-256-CBC encrypt for billing-key encData, with explicit `Buffer.fill(0)` zeroize after use.
- [x] 3.5 `client.ts`: thin fetch wrapper with `timeout`, `retries=0` for state-changing calls, JSON request/response, structured error mapping, request-id logging that masks card-data fields.
- [x] 3.6 `payments.ts`: `approve(tid, amount, ediDate)`, `cancel(tid, opts)`, `findByOrderId(orderId)`, `findByTid(tid)`.
- [x] 3.7 `billing-keys.ts`: `issue({orderId, encData})`, `approve({bid, orderId, amount, goodsName, cardQuota='0'})`, `expire({bid, orderId})`.
- [x] 3.8 `cash-receipts.ts`: `issue(...)`, `cancel(...)`, `getStatus(...)` for vbank/cash flows.
- [x] 3.9 `adapter.ts`: map NICE responses → `ProviderPaymentResult` for both one-shot and recurring flows.
- [x] 3.10 `order-id.ts`: regex-validated generator `splash_{userIdShort8}_{epochSeconds}_{rand4}` with collision retry.
- [x] 3.11 `errors.ts`: typed error classes (NicepaySignatureError, NicepayAmountMismatch, NicepayApiError with `resultCode`, NicepayBillingKeyCardOnly).
- [x] 3.12 Unit tests: signature formulas (golden values from official docs), AES round-trip with sample card, basic-auth header, order-id generator, adapter mappings, error mapping for known `resultCode`s.

## 4. Billing core refactor (PG-neutral)

- [x] 4.1 Rename input type in `src/lib/billing/record-payment.ts` from `PaypleResponse` → `ProviderPaymentResult` per design.md §D14.
- [x] 4.2 Update `record-payment.ts` to upsert Payment by `orderId`, Invoice by `(subscriptionId, periodStart)`, and to derive billing events from the neutral input.
- [x] 4.3 Verify `src/lib/billing/state-machine.ts` requires no changes (PG-agnostic). Add `refunded` event handling if missing.
- [x] 4.4 Update existing `state-machine.test.ts` and `record-payment.test.ts` to the new neutral type. Remove all Payple references.
- [x] 4.5 Add `tier-write-allowlist.test.ts` update enumerating the 5 allowed write paths in subscription/spec.md.
- [x] 4.6 Add import-graph guard test: `state-machine.ts` MUST NOT import from `src/lib/nicepay/**`.

## 5. tRPC payment router

- [x] 5.1 Create `src/server/routers/payment.ts` with procedures: `getPricing` (public), `createCheckoutSession` (protected, plan: 'monthly'|'yearly'), `cancelSubscription`, `uncancelSubscription`, `listPayments`, `requestRefund` (self-serve gates), `requestPartialRefund` (admin), `expireBillingKey` (admin).
- [x] 5.2 `createCheckoutSession`: allocate orderId, insert pending Payment in a Prisma transaction, return `{ orderId, amount, goodsName, returnUrl, jsSdkUrl, clientId, currency: 'KRW' }`.
- [x] 5.3 `requestRefund`: enforce 7-day + usage 0 gates, call NICE cancel, transition state, dispatch refund email.
- [x] 5.4 `cancelSubscription` / `uncancelSubscription`: update `cancelEffectiveAt`, `billingState`, `nextBillingDate` per design.md §D9.
- [x] 5.5 Wire router into `src/server/routers/_app.ts`.
- [x] 5.6 Tests: per-procedure unit tests with mocked Prisma + mocked NICE client; cover success, signature/amount mismatch, refund eligibility branches.

## 6. Return URL handler — `/api/payments/nicepay/return`

- [x] 6.1 Create `src/app/api/payments/nicepay/return/route.ts` with `export const runtime = 'nodejs'`, `export const maxDuration = 60`.
- [x] 6.2 Parse `request.formData()`; extract `authResultCode`, `authToken`, `tid`, `orderId`, `amount`, `signature`, `ediDate`, `mallReserved`.
- [x] 6.3 Lookup pending Payment by orderId; if missing/expired → 303 redirect to `/account/payments?status=failed&reason=unknown_order`.
- [x] 6.4 Validate signature via `signature.ts#timingSafeEqual`; on failure → mark Payment failed, log security event, redirect with `reason=signature_mismatch`.
- [x] 6.5 Validate amount equality with pending Payment; on mismatch → mark failed, redirect with `reason=amount_mismatch`.
- [x] 6.6 Call NICE `payments.approve(tid, amount, ediDate)` with Basic auth; on success update Payment to paid + `recordPaymentResult` inside the same transaction; on failure mark failed with NICE `resultCode/resultMsg`.
- [x] 6.7 If first Pro payment for the user, also issue billing key in the same flow (per design.md §D6) — only when method=card.
- [x] 6.8 303 redirect to `/account/payments?status=success&orderId=...` (or failed status with reason).
- [x] 6.9 Add CSRF middleware exemption for this route (rely on signature/amount validation).
- [x] 6.10 Integration tests with mocked NICE client: success path, signature failure, amount tampering, NICE non-zero resultCode, duplicate replay.

## 7. Webhook handler — `/api/webhooks/nicepay`

- [x] 7.1 Create `src/app/api/webhooks/nicepay/route.ts` with `export const runtime = 'nodejs'`, `export const maxDuration = 10`.
- [x] 7.2 Parse JSON body, validate `signData`; on failure persist `WebhookEvent { processingError: 'invalid_signature' }` and 400.
- [x] 7.3 Insert `WebhookEvent { eventId, type, payload, signatureValid: true, receivedAt }`; rely on `eventId` unique for replay short-circuit (catch P2002 → 200).
- [x] 7.4 Dispatch by type: `paid` (vbank deposit), `expired` (vbank), `cancelled`, `recurring_paid`, `recurring_failed`. Each handler is idempotent and uses `recordPaymentResult`.
- [x] 7.5 Set `processedAt` after successful dispatch; respond 200 within 5s.
- [x] 7.6 Tests: signature validation, replay short-circuit (P2002), each dispatched type with mocked Prisma.

## 8. Cron — `/api/cron/billing`

- [x] 8.1 Create `src/app/api/cron/billing/route.ts` (Node runtime, GET).
- [x] 8.2 Auth gate: require `Authorization: Bearer ${CRON_SECRET}`; otherwise 401.
- [x] 8.3 Query subscriptions where `billingState='active' AND nextBillingDate <= now()` (and `cancelEffectiveAt <= now()` for grace expiry), batch through with cursor pagination.
- [x] 8.4 For each row: insert Invoice (idempotent via `(subscriptionId, periodStart)`), allocate orderId, call `billing-keys.approve`, call `recordPaymentResult`, advance `periodStart/periodEnd/nextBillingDate` on success.
- [x] 8.5 Implement retry policy: failure increments `failedRetryCount`, reschedules `nextBillingDate` to `+1d/+3d/+7d`; third failure transitions to `canceled_grace` with `cancelEffectiveAt = now()+7d`.
- [x] 8.6 Process `canceled_grace` rows whose `cancelEffectiveAt <= now()` → state `expired`, downgrade `tier='free'`, send AutoDowngrade email.
- [x] 8.7 Add `vercel.json` cron entry: `{ "path": "/api/cron/billing", "schedule": "10 15 * * *" }` (00:10 KST).
- [x] 8.8 Tests: success renewal, failed retry escalation, grace expiry, cron auth gate, idempotency on double run.

## 9. UI — pricing & account

- [x] 9.1 Add `src/lib/payments/pricing.ts` exposing pricing constants from env, used by `/pricing` and `paymentRouter.getPricing`.
- [x] 9.2 Build `src/components/checkout/nicepay-script.tsx` (`next/script` afterInteractive) and `src/components/checkout/use-nicepay.ts` hook wrapping `AUTHNICE.requestPay`.
- [x] 9.3 Build `src/app/pricing/page.tsx`: monthly/annual toggle, feature comparison, primary CTA invoking `createCheckoutSession` then `useNicepay.requestPay`. Login redirect for guests.
- [x] 9.4 Build `src/app/account/payments/page.tsx`: subscription state panel, payment history table with NICE receipt links, cancel/uncancel/refund buttons gated by eligibility.
- [x] 9.5 Build dashboard upgrade CTA component reading rate-limit hint from `/api/usage` or tRPC.
- [x] 9.6 Toggle visibility on `NEXT_PUBLIC_PAYMENTS_ENABLED`. Render "✍ 공개" placeholder when off.
- [ ] 9.7 E2E tests via Playwright (existing harness if present, otherwise minimal): guest CTA → login → pricing → mocked NICE checkout → return URL → success page (sandbox-stubbed).

## 10. Email integration

- [x] 10.1 Update existing PaymentSuccessEmail / PaymentFailureEmail / CancellationEmail / AutoDowngradeEmail templates to drop Payple references and accept the neutral data shape.
- [x] 10.2 Add `RefundConfirmationEmail` template.
- [x] 10.3 Wire all email dispatches inside `record-payment.ts` and the cron grace-expiry path.
- [x] 10.4 Snapshot tests for KRW formatting (e.g., 19,900원).

## 11. Verification & release

- [x] 11.1 Run `pnpm lint`, `pnpm typecheck`, `pnpm test` — all green for NICE scope (101 tests passing; pre-existing repo-wide TS/lint errors in unrelated files documented in qa-log.md).
- [ ] 11.2 Manual sandbox QA matrix (record results in change folder `qa-log.md`):
  - Card: success, signature mismatch, amount mismatch, NICE 4xx
  - Vbank: deposit-completed via webhook, expiry via webhook
  - Billing key: issue, approve, expire (admin)
  - Refund: self-serve eligible, self-serve blocked, admin partial
  - Cron: renewal success, retry escalation, grace expiry
  - Cancel/uncancel UX
- [ ] 11.3 NICE console: register webhook URL `https://usesplash.vercel.app/api/webhooks/nicepay` and confirm dummy delivery succeeds.
- [x] 11.4 Vercel: register cron, set test-mode env vars (3 environments), deploy production. Smoke-tested `/pricing` (200), `/account/payments` (200), `/api/cron/billing` (401 unauth / 200 with bearer / `processed:{renewed:0,failed:0,downgraded:0}`), `/api/webhooks/nicepay` (POST invalid_json → 400). Production URL: https://splash.ai.kr (alias of https://usesplash.vercel.app).
- [ ] 11.5 Production canary: switch `NICEPAY_MODE=live` for a single internal account, perform 1 real Pro payment, confirm DB state and receipt, then immediately refund.
- [ ] 11.6 Flip `NEXT_PUBLIC_PAYMENTS_ENABLED=true` in production after canary success.
- [x] 11.7 Run `openspec validate nicepay-payment-integration --strict` — passes.
