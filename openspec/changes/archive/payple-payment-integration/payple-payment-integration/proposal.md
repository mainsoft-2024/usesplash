## Why

Splash currently has a `Subscription` model with tier-based limits (free / pro / demo / enterprise) but no way for users to actually pay to upgrade — `adminUpdateTier` is the only path, and it's admin-only. To turn Splash into a real SaaS we need an end-to-end payment flow that lets users self-service upgrade to Pro (recurring monthly billing) and lets foreign users pay with international cards. We chose Payple as the PG because it covers both Korean domestic recurring billing (PCD billing-key flow) and international card payments (Payple Global) with a single vendor relationship, which avoids stitching together Toss + Stripe.

## What Changes

- Add Payple integration covering **국내 카드 정기결제 (billing-key)** AND **해외 카드 단건결제** in the first release. Domestic uses recurring monthly billing; international uses one-shot charges (Payple Global billing-key recurring is supported but deferred to a follow-up after live-account approval).
- Add `/pricing` page and a "Pro로 업그레이드" CTA on `/projects` dashboard.
- Add `/api/payple/auth` (partner-auth proxy) and `/api/payple/webhook` (single endpoint, branches by event type and region) routes.
- Add `payment` tRPC router: `createCheckoutSession`, `saveBillingKey`, `chargeNow`, `cancelSubscription`, `listPayments`, `getReceiptUrl`.
- Extend `Subscription` model with billing fields (`billingKey`, `billingKeyType`, `paymentMethod`, `nextBillingDate`, `currency`, `canceledAt`, `cancelReason`, `failedRetryCount`).
- Add new tables: `Payment` (history), `BillingKey` (multiple cards per user, soft-deletable), `Invoice` (월 청구 단위, future-proof).
- Auto-renewal: Vercel Cron daily at 00:00 KST scans `nextBillingDate <= today AND tier='pro' AND canceledAt IS NULL` and charges via stored billing-key. **3-strike retry**: failure → retry +1d → retry +3d → on 3rd failure auto-downgrade to `free` and notify by email.
- Cancellation policy: user-initiated cancel marks `canceledAt`, keeps `tier='pro'` until `nextBillingDate`, then cron flips to `free`.
- Receipts: persist Payple's `PCD_PAY_CARDRECEIPT` URL on `Payment` and expose on a new `/account/payments` page.
- Email notifications via **Resend**: payment success, payment failure (per retry attempt), cancellation confirmation, auto-downgrade after 3 failures.
- Order ID format: `splash_{userIdShort8}_{epochSeconds}` (≤64 chars, satisfies Payple OID limit).
- Pricing held in env vars: `PRICE_PRO_MONTH_KRW=9000` (VAT 별도, displayed as "₩9,000 + VAT") and `PRICE_PRO_MONTH_USD=7.99`.
- Webhook reliability: signed verification not available from Payple, so every webhook receipt re-queries Payple's lookup API (`/php/payInfo.php` or `/gpay/result`) before mutating state. Idempotency on `paypleOrderId`.
- Domain whitelisting for Payple Referer check: production (`usesplash.vercel.app`) + Vercel preview wildcard pattern (`*-mainsoft-2024.vercel.app`).
- Test coverage: Vitest unit tests for Payple HTTP client (mocked fetch) + tRPC router (mocked client) + webhook handler.

## Capabilities

### New Capabilities
- `payment-processing`: All Payple HTTP interactions (partner auth, billing-key issuance, charge, refund, lookup), webhook intake, retry/idempotency rules, order ID generation, currency handling for KRW/USD.
- `billing-lifecycle`: Subscription billing model — recurring schedule, auto-renewal cron, cancellation policy with grace period until `nextBillingDate`, 3-strike failure auto-downgrade, manual `chargeNow` trigger.
- `pricing-and-checkout-ui`: `/pricing` page, dashboard upgrade CTA, Payple checkout-script loading (`next/script` with strict CSP), domestic vs international plan tab UX, post-payment redirect/toast handling.
- `payment-history-ui`: `/account/payments` user-facing payments page (list + receipt link), cancel-subscription button with confirm modal.
- `transactional-email`: Resend integration for payment-success, payment-failure (with attempt count), cancellation-confirmation, auto-downgrade emails. Templates as React Email components.

### Modified Capabilities
- `subscription`: tier upgrade/downgrade is no longer admin-only — `payment-processing` writes `tier='pro'` on first successful charge and writes `tier='free'` on cancellation grace expiry or 3-strike failure. New behavioral requirement: subscription state must reflect billing reality, not be set independently. (Existing free/pro tier limit semantics in `TIER_LIMITS` are unchanged.)

## Impact

**Code**
- New: `src/lib/payple/` (client, types, signing, order-id, currency), `src/lib/email/` (Resend client + templates), `src/server/routers/payment.ts`, `src/app/api/payple/auth/route.ts`, `src/app/api/payple/webhook/route.ts`, `src/app/api/cron/billing/route.ts`, `src/app/pricing/page.tsx`, `src/app/account/payments/page.tsx`, `src/components/payple-checkout-button.tsx`, `src/components/cancel-subscription-modal.tsx`, `src/components/upgrade-cta.tsx`.
- Modified: `prisma/schema.prisma` (extend `Subscription`, add `Payment`/`BillingKey`/`Invoice`), `src/server/routers/_app.ts` (register `payment` router), `src/server/routers/subscription.ts` (`adminUpdateTier` becomes one of many writers), `src/app/projects/page.tsx` (CTA), `next.config.ts` (CSP for Payple script domains), `vercel.json` (cron entry).

**APIs**
- New external dependency: Payple PCD API (domestic) + Payple Global API + Resend API.
- New internal endpoints: `POST /api/payple/auth`, `POST /api/payple/webhook`, `GET /api/cron/billing` (cron-secret guarded).
- New tRPC procedures under `payment.*`.

**Dependencies**
- Add: `resend`, `@react-email/components`, `@react-email/render`.
- No new Payple SDK — REST direct.

**Env vars**
- `PAYPLE_TEST_CST_ID`, `PAYPLE_TEST_CUST_KEY`, `PAYPLE_TEST_CLIENT_KEY`, `PAYPLE_TEST_REFUND_KEY`
- `PAYPLE_LIVE_*` (mirror, blank until contract closes)
- `PAYPLE_GLOBAL_TEST_SERVICE_ID`, `PAYPLE_GLOBAL_TEST_SERVICE_KEY` (+ `_LIVE_*`)
- `PAYPLE_MODE` = `test` | `live`
- `PRICE_PRO_MONTH_KRW`, `PRICE_PRO_MONTH_USD`
- `RESEND_API_KEY`, `EMAIL_FROM`
- `CRON_SECRET` (for `/api/cron/billing` auth header)

**Database**
- Single migration: schema additions only, no destructive changes. Backfill: existing `Subscription` rows get nullable billing fields (no data migration needed since current users have no billing).

**Risk surface**
- Payple webhook spoofing — mitigated by always re-querying Payple lookup API before state mutation.
- Cron double-fire — idempotency keyed on `(subscriptionId, billingPeriodStart)` so a second run no-ops.
- Vercel preview domains rotating — solved by registering wildcard pattern with Payple support.
- Live `cpid` not yet issued — entire flow built and tested on test cpid; switch is one env-var flip.
