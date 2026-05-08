## 1. Foundation: env, config, deps

- [ ] 1.1 Add deps `resend`, `@react-email/components`, `@react-email/render` to `package.json` and `pnpm install`
- [ ] 1.2 Add Payple + Resend + cron + pricing env vars to `.env.example` (full list per proposal Impact)
- [ ] 1.3 Add `PAYPLE_MODE` env switch with default `test`; document in `AGENTS.md`
- [ ] 1.4 Update `next.config.ts` CSP `headers()` for Payple script + frame domains
- [ ] 1.5 Add `vercel.json` cron entry: `{ path: "/api/cron/billing", schedule: "0 15 * * *" }`
- [ ] 1.6 Add `NEXT_PUBLIC_PAYMENTS_ENABLED` feature flag (default `false`)

## 2. Database schema

- [ ] 2.1 Extend `Subscription` model in `prisma/schema.prisma` with billingKey, billingKeyType, paymentMethod, currency, nextBillingDate, failedRetryCount, canceledAt, cancelReason fields and `@@index([nextBillingDate, tier])`
- [ ] 2.2 Add `BillingKey`, `Payment`, `Invoice` models per design.md exactly
- [ ] 2.3 Run `npx prisma migrate dev --name add_payple_payment_models`; verify `prisma/migrations/<ts>_add_payple_payment_models/migration.sql` is additive only
- [ ] 2.4 `npx prisma generate`; ensure `pnpm build` still passes

## 3. Payple HTTP client

- [ ] 3.1 Create `src/lib/payple/types.ts` with `PCDAuthResponse`, `PCDPayResponse`, `GlobalAuthResponse`, `GlobalPayResponse`, etc.
- [ ] 3.2 Create `src/lib/payple/errors.ts` (`PaypleError`, `AlreadyRefundedError`, `LookupMismatchError`)
- [ ] 3.3 Create `src/lib/payple/client.ts` with mode-aware base URL, Referer header, 5xx single retry, 8s/15s timeouts
- [ ] 3.4 Create `src/lib/payple/order-id.ts` (`generateOrderId(userId)` with sub-second `_NN` suffix); add unit test
- [ ] 3.5 Create `src/lib/payple/currency.ts` (`krwWithVat`, `usdToCents`, `formatMoney`); add unit test
- [ ] 3.6 Create `src/lib/payple/domestic.ts` (`auth`, `issueBillingKey` results parser, `charge`, `refund`, `lookup`); add unit tests with mocked client
- [ ] 3.7 Create `src/lib/payple/global.ts` (`oauthToken`, `charge`, `lookup`); add unit tests
- [ ] 3.8 Create `src/lib/payple/verify.ts` (`verifyByLookup(orderId, region)`); unit-test mismatch + match cases

## 4. Billing state machine + recordPaymentResult

- [ ] 4.1 Create `src/lib/billing/state-machine.ts` with `transition(state, event)`; cover all 5 states × 5 events; add full table-driven unit test
- [ ] 4.2 Create `src/lib/billing/record-payment.ts` exporting `recordPaymentResult({ subscriptionId, paypleResponse, region })` that runs in a Prisma transaction, upserts `Payment` and `Invoice`, applies state transition; add integration test against a test DB
- [ ] 4.3 Add a unit-level test that grep-asserts no other module writes `Subscription.tier` (allowlist: `record-payment.ts`, `subscription.adminUpdateTier`, `cron/billing/route.ts`)

## 5. Email (Resend)

- [ ] 5.1 Create `src/lib/email/client.ts` with skip-on-missing-env behavior; unit test both paths
- [ ] 5.2 Create `src/lib/email/templates/BaseLayout.tsx` with Splash branding
- [ ] 5.3 Create `PaymentSuccessEmail.tsx` (KRW/USD subject branching)
- [ ] 5.4 Create `PaymentFailureEmail.tsx` with attempt count + retry date
- [ ] 5.5 Create `CancellationEmail.tsx` with access-end date
- [ ] 5.6 Create `AutoDowngradeEmail.tsx` with re-upgrade CTA
- [ ] 5.7 Add a `pnpm email:preview` script using `react-email dev` for local QA

## 6. tRPC payment router

- [ ] 6.1 Create `src/server/routers/payment.ts` with `createCheckoutSession`, `saveBillingKey`, `chargeNow`, `cancelSubscription`, `uncancelSubscription`, `listPayments`, `getReceiptUrl`
- [ ] 6.2 Wire `paymentRouter` into `src/server/routers/_app.ts`
- [ ] 6.3 Add `src/server/routers/payment.test.ts` covering each procedure with mocked Payple client + in-memory Prisma
- [ ] 6.4 Ensure `cancelSubscription` accepts optional `reason` enum (UI dropdown values)

## 7. API routes

- [ ] 7.1 Create `src/app/api/payple/auth/route.ts` (POST, session-guarded, calls domestic or global auth)
- [ ] 7.2 Create `src/app/api/payple/webhook/route.ts` (POST, region detection, lookup-verify, idempotent commit, returns `{ isOk: true }` on all success paths)
- [ ] 7.3 Create `src/app/api/cron/billing/route.ts` (GET, `Authorization: Bearer ${CRON_SECRET}` guard, batch=200, transition + retry policy)
- [ ] 7.4 Add Vitest tests for all three routes using `next/server` request mocks

## 8. UI: pricing + checkout

- [ ] 8.1 Create `src/components/pricing-card.tsx` reusable Pro/Free card
- [ ] 8.2 Create `src/components/payple-checkout-button.tsx` with `next/script` `afterInteractive` strategy, dynamic-import wrapper for SSR safety
- [ ] 8.3 Create `src/app/pricing/page.tsx` with KRW/USD region toggle, current-plan badge, login redirect for anonymous, and gated by `NEXT_PUBLIC_PAYMENTS_ENABLED`
- [ ] 8.4 Add window callback `onPaypleResult` registered by checkout button; on success invalidate `subscription.getCurrent` and route to `/account/payments?welcome=pro`
- [ ] 8.5 Toast on script-load failure ("결제 시스템 연결에 실패했어요…")

## 9. UI: dashboard CTA

- [ ] 9.1 Create `src/components/upgrade-cta.tsx`; render only for `free`/`expired` states
- [ ] 9.2 Mount CTA in `src/app/projects/page.tsx` header
- [ ] 9.3 Hide CTA for `active`/`pending_retry`/`canceled_grace`

## 10. UI: account/payments

- [ ] 10.1 Create `src/components/subscription-status-panel.tsx` with state-driven primary action button per spec table
- [ ] 10.2 Create `src/components/cancel-subscription-modal.tsx` with "해지" typing gate, optional reason dropdown
- [ ] 10.3 Create `src/app/account/payments/page.tsx` with paginated list, receipt links, status panel
- [ ] 10.4 Empty-state for `free` with CTA to `/pricing`

## 11. End-to-end manual test on preview

- [ ] 11.1 Push branch, get preview URL, register preview + production domains with Payple support email (help@payple.kr)
- [ ] 11.2 Request whitelist for at least one test card from Payple
- [ ] 11.3 Run full domestic flow on preview: subscribe → see payment row → cancel → confirm grace state → trigger cron manually with `CRON_SECRET` curl → confirm grace expiry path
- [ ] 11.4 Run failure path: configure pricing to a known-fail amount or use Payple's failure-test card; verify retry + 3-strike auto-downgrade + email
- [ ] 11.5 Run international flow with a foreign-card test card; verify `paymentRegion="international"` row and that cron skips it

## 12. Verification & docs

- [ ] 12.1 `pnpm build` passes; `pnpm test` (Vitest) passes with target coverage on `src/lib/payple/` and `src/lib/billing/`
- [ ] 12.2 `npx prisma migrate deploy` dry-run on a copy DB
- [ ] 12.3 Update `AGENTS.md` with Payple section (env vars, mode switch, webhook flow, cron, known-issues)
- [ ] 12.4 Run `openspec validate payple-payment-integration --strict` and fix any reports
- [ ] 12.5 Open PR; after review, merge to `main` with `NEXT_PUBLIC_PAYMENTS_ENABLED=false` in production env
- [ ] 12.6 Smoke test on production: `/pricing` and `/account/payments` render but checkout button is hidden behind the flag
