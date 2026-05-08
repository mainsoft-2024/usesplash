## Architecture overview

```
┌──────────────────┐    1. createCheckoutSession    ┌───────────────────┐
│ Browser          │ ─────────────────────────────▶ │ tRPC payment.*    │
│ /pricing         │ ◀──── { authToken, oid } ───── │ (server actions)  │
│ + cpay.js script │                                └───────────────────┘
│                  │ 2. PaypleCpayAuthCheck(obj)
│                  │ ────────────────────────────▶  ┌───────────────────┐
│                  │                                │ Payple PCD overlay│
│                  │ 3. result POST PCD_RST_URL ─▶  └───────────────────┘
└──────────────────┘                                          │
        ▲                                                      │
        │ 6. router.invalidate(subscription.getCurrent)        │
        │                                                      │
        │   ┌───────────────────┐  4. lookup verify  ┌─────────▼─────────┐
        └───│ /api/payple/      │ ─────────────────▶ │ Payple lookup API │
            │   webhook         │ ◀──── status ───── └───────────────────┘
            │ /api/payple/      │
            │   result          │ 5. write Payment + Subscription tier
            └───────┬───────────┘
                    ▼
            ┌───────────────────┐
            │ Postgres (Neon)   │
            └───────────────────┘
                    ▲
                    │ daily 00:00 KST
            ┌───────┴───────────┐
            │ /api/cron/billing │ ─── chargeDomestic(payerId, amount) ───▶ Payple
            └───────────────────┘
                    │
                    ▼
            ┌───────────────────┐
            │ Resend            │
            └───────────────────┘
```

Three independent ingress points: tRPC (auth + checkout init), Payple result/webhook callback (POST), Vercel Cron (daily renewal). All converge on a single `recordPaymentResult()` core helper that owns the state machine — no other site is allowed to write `Subscription.tier` or insert `Payment` rows.

## Module layout

```
src/
├── lib/
│   ├── payple/
│   │   ├── client.ts            # fetch wrapper, mode-aware base URL, retry on 5xx
│   │   ├── domestic.ts          # auth(), issueBillingKey, charge, refund, lookup
│   │   ├── global.ts            # oauthToken, charge, lookup
│   │   ├── order-id.ts          # generateOrderId(userId): string
│   │   ├── verify.ts            # verifyByLookup(orderId, region): VerifyResult
│   │   ├── currency.ts          # formatMoney, krwWithVat, usdToCents
│   │   ├── types.ts             # PaypleEnv, PCDAuthResponse, GlobalAuthResponse, ...
│   │   └── errors.ts            # PaypleError, AlreadyRefundedError, …
│   ├── email/
│   │   ├── client.ts            # sendEmail() wrapper
│   │   └── templates/
│   │       ├── BaseLayout.tsx
│   │       ├── PaymentSuccessEmail.tsx
│   │       ├── PaymentFailureEmail.tsx
│   │       ├── CancellationEmail.tsx
│   │       └── AutoDowngradeEmail.tsx
│   └── billing/
│       ├── state-machine.ts     # transitions: charge/cancel/grace-expiry/3-fail
│       └── record-payment.ts    # recordPaymentResult() — sole writer of tier
├── server/routers/
│   └── payment.ts               # createCheckoutSession, saveBillingKey,
│                                # chargeNow, cancelSubscription,
│                                # uncancelSubscription, listPayments,
│                                # getReceiptUrl
├── app/
│   ├── pricing/page.tsx
│   ├── account/payments/page.tsx
│   └── api/
│       ├── payple/
│       │   ├── auth/route.ts
│       │   └── webhook/route.ts
│       └── cron/billing/route.ts
└── components/
    ├── upgrade-cta.tsx
    ├── payple-checkout-button.tsx
    ├── pricing-card.tsx
    ├── subscription-status-panel.tsx
    └── cancel-subscription-modal.tsx
```

## Data model

### Schema delta

```prisma
model Subscription {
  id                 String    @id @default(cuid())
  userId             String    @unique
  tier               String    @default("free")
  dailyGenerations   Int       @default(0)
  dailyResetAt       DateTime  @default(now())

  // NEW — billing
  billingKey         String?
  billingKeyType     String?   // "domestic_card" | "international_card"
  paymentMethod      String?   // "card" | "kakao" | "naver" | "international_card"
  currency           String?   // "KRW" | "USD"
  nextBillingDate    DateTime?
  failedRetryCount   Int       @default(0)
  canceledAt         DateTime?
  cancelReason       String?

  user               User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  payments           Payment[]
  invoices           Invoice[]
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@index([nextBillingDate, tier])  // for cron scan
}

model BillingKey {
  id          String    @id @default(cuid())
  userId      String
  payerId     String                                   // PCD_PAYER_ID or global billing_key
  type        String                                   // "domestic_card" | "international_card"
  cardName    String?                                  // card issuer name
  cardNum     String?                                  // last-4 masked
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  lastUsedAt  DateTime?
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, payerId])
  @@index([userId, isActive])
}

model Payment {
  id              String    @id @default(cuid())
  subscriptionId  String
  userId          String

  paypleOrderId   String    @unique                    // PCD_PAY_OID
  payplePayId     String?                              // global pay_id
  payerId         String?                              // billing key used

  amount          Int                                  // KRW: won, USD: cents
  currency        String                               // "KRW" | "USD"
  paymentRegion   String    @default("domestic")       // "domestic" | "international"
  paymentType     String                               // "card" | "international_card"

  status          String                               // "pending" | "completed" | "failed"
                                                       // | "refunded" | "suspicious"
  errorCode       String?
  errorMessage    String?

  cardName        String?
  cardNum         String?
  receiptUrl      String?

  paidAt          DateTime?
  refundedAt      DateTime?
  createdAt       DateTime  @default(now())

  subscription    Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([status])
  @@index([subscriptionId, createdAt])
}

model Invoice {
  id              String    @id @default(cuid())
  subscriptionId  String
  userId          String

  periodStart     DateTime
  periodEnd       DateTime
  amount          Int
  currency        String

  status          String                               // "issued" | "paid" | "failed" | "pending_user_action"
  paymentId       String?

  createdAt       DateTime  @default(now())

  subscription    Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@unique([subscriptionId, periodStart])              // cron idempotency anchor
  @@index([userId])
  @@index([status])
}
```

### Why these choices

- **Subscription stays single-row per user** rather than a separate `Subscription`+`SubscriptionVersion` split: simpler reads, and we never need a billing-history view of plan changes for v1.
- **`Invoice.@@unique([subscriptionId, periodStart])`** is the cron's idempotency key. Even if Vercel re-fires the cron or the function retries, the second attempt for the same period violates the unique constraint and is treated as a no-op.
- **`Payment.paypleOrderId @unique`** plus `Invoice` unique = two layers of dedupe; webhook double-fire and cron double-fire both safe.
- **`Payment.amount` as `Int`** keeps arithmetic exact; we never store decimals. USD is cents.
- **No card tokens stored** — only Payple's billing key. Compliant with `5.1` of the research doc.

## State machine — single source of truth

`src/lib/billing/state-machine.ts` exposes:

```ts
type State = "free" | "active" | "pending_retry" | "canceled_grace" | "expired";
type Event =
  | { kind: "charge_succeeded"; nextBillingDate: Date }
  | { kind: "charge_failed"; attempt: 1 | 2 | 3 }
  | { kind: "user_canceled"; reason: string }
  | { kind: "user_uncanceled" }
  | { kind: "grace_expired" };

export function transition(s: State, e: Event): {
  state: State;
  patch: Partial<Subscription>;
  email?: EmailKind;
};
```

`recordPaymentResult()` and `cancelSubscription()` and the cron all funnel through `transition()`. No state writes happen elsewhere. Unit tests are a flat table of `(state, event) → expected`.

## Payple HTTP client

Single `payple.client.ts` with `request<T>(method, path, body, { region })`:
- chooses base URL from `PAYPLE_MODE`
- adds `Referer` from `NEXT_PUBLIC_APP_URL`
- retries once on 5xx with 500ms backoff (no retry on 4xx — they're business errors)
- timeouts: 8s for auth, 15s for charge/refund

`domestic.ts` and `global.ts` wrap `request` with typed signatures. Tests mock the client only, never `fetch` directly.

## Webhook handler logic

```
POST /api/payple/webhook
 1. Detect region: content-type=application/x-www-form-urlencoded → domestic
                                  application/json              → global
 2. Extract { orderId, payerId, amount, status }
 3. Call payple.lookup(orderId, region)
 4. If lookup.status !== "success" or amounts mismatch:
      - upsert Payment with status="suspicious"
      - log alert
      - return 200 { isOk: true }
 5. Else (verified):
      - Within transaction:
        - upsert Payment by paypleOrderId
        - upsert Invoice by (subscriptionId, periodStart)
        - call transition(currentState, { kind: "charge_succeeded", nextBillingDate })
        - apply patch
      - After commit, fire-and-forget sendEmail(success)
      - return 200 { isOk: true }
```

Returning 200 on every accepted webhook (success, suspicious, duplicate) prevents Payple from infinitely retrying delivery — we have our own lookup-based truth.

## Cron handler logic

```
GET /api/cron/billing
 1. Verify Authorization: Bearer ${CRON_SECRET}
 2. Find subs WHERE tier="pro"
                   AND nextBillingDate <= now()
                   AND billingKeyType="domestic_card"
                   ORDER BY nextBillingDate ASC LIMIT 200
 3. For each sub:
    a. If canceledAt IS NOT NULL: transition(s, { kind: "grace_expired" })
                                   → set tier="free", send CancellationEmail
       continue.
    b. Else: try domestic.charge(payerId, amount)
       - on success: transition(s, { kind: "charge_succeeded", ... })
       - on failure: transition(s, { kind: "charge_failed", attempt })
    c. Catch and log per-row; one bad sub does not abort the batch.
 4. Return JSON { processed, succeeded, failed, downgraded }.
```

## CSP and Next config

```ts
// next.config.ts (excerpt)
async headers() {
  const paypleHosts = [
    "https://democpay.payple.kr",
    "https://cpay.payple.kr",
    "https://demo-api.payple.kr",
    "https://api.payple.kr",
  ].join(" ");
  return [{
    source: "/(.*)",
    headers: [{
      key: "Content-Security-Policy",
      value:
        `default-src 'self'; ` +
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${paypleHosts}; ` +
        `connect-src 'self' ${paypleHosts} https://*.vercel.app; ` +
        `frame-src ${paypleHosts}; ` +
        `img-src 'self' data: blob: https:;`,
    }],
  }];
}
```

`'unsafe-eval'` is needed because `cpay.js` uses dynamic eval for legacy IE support; this is a Payple constraint, documented in their FAQ.

## tRPC contract

```ts
payment.createCheckoutSession({ region: "domestic" | "international" })
  → { authToken, clientKey, orderId, goods, totalAmount }

payment.saveBillingKey({ payerId, region, cardName?, cardNum? })
  → { billingKeyId }

payment.chargeNow()
  → { status: "completed" | "failed" | "already_active" }

payment.cancelSubscription({ reason?: string })
  → { canceledAt: Date, accessUntil: Date }

payment.uncancelSubscription()
  → { ok: true }

payment.listPayments({ cursor?, limit? = 20 })
  → { items: Payment[], nextCursor? }

payment.getReceiptUrl({ paymentId })
  → { url: string }
```

All procedures are `protectedProcedure`. Ownership is enforced by `where: { userId: ctx.session.user.id }` on every query.

## Testing approach

Unit (Vitest):
- `src/lib/payple/order-id.test.ts` — collision suffix, length cap.
- `src/lib/payple/currency.test.ts` — VAT calc, USD cents.
- `src/lib/payple/domestic.test.ts` — happy + 4xx + 5xx retry, with `vi.fn()` fetch.
- `src/lib/payple/global.test.ts` — same shape.
- `src/lib/billing/state-machine.test.ts` — table of `(state, event) → next`.
- `src/server/routers/payment.test.ts` — each procedure with mocked `paypleClient`.
- `src/app/api/payple/webhook/route.test.ts` — supertest-style invocation, lookup mocked, asserts DB writes.
- `src/app/api/cron/billing/route.test.ts` — covers success, 1st/2nd/3rd failure, grace expiry, auth rejection.

Coverage target: 90% on `src/lib/payple/`, `src/lib/billing/`, and the two API routes.

No E2E for the Payple overlay — visual flow verified manually on the preview deploy.

## Migration & rollout

1. Land schema migration (additive only).
2. Ship code with `PAYPLE_MODE=test` and zero env vars set in production. Pricing page renders behind a feature flag `NEXT_PUBLIC_PAYMENTS_ENABLED=false`.
3. Register preview + production domains with Payple.
4. Flip `NEXT_PUBLIC_PAYMENTS_ENABLED=true` on preview, do manual end-to-end test with the test cpid (whitelisted card).
5. Once contract closes and live cpid arrives, set `PAYPLE_MODE=live` + live secrets in production.
6. Flip `NEXT_PUBLIC_PAYMENTS_ENABLED=true` on production.

## Risks and decisions

| Risk                                    | Decision                                                                 |
|-----------------------------------------|--------------------------------------------------------------------------|
| Payple has no webhook signature         | Always re-query lookup API before mutating state                          |
| Vercel preview domain rotates           | Register wildcard `*-mainsoft-2024.vercel.app` with Payple support        |
| Cron double-fires                       | `Invoice` unique key on `(subscriptionId, periodStart)`                   |
| User attempts subscribe twice           | `BillingKey` unique on `(userId, payerId)`; first issuance deactivates old |
| Refund partial / dispute                | Out of scope — full-refund-only helper, partial refunds in v2             |
| International recurring                 | Deferred — global billing key stored but cron skips it                    |
| Live cpid not yet issued                | Whole flow built in test mode; live is a one-line env flip                 |
| Email provider down                     | `sendEmail` returns `{ skipped: true }`, never throws                     |
| Korean holidays vs cron                 | Idempotency tolerates a missed day; next run picks up backlog (LIMIT 200) |

## Open questions resolved during interview

- Domestic recurring: yes (billing-key flow).
- International recurring: deferred. International is one-shot in v1; cron skips them.
- Email: include success/failure/cancel/auto-downgrade in v1, via Resend.
- VAT: 별도 표기. Stored amount is post-VAT.
- Admin refund UI: deferred to v2; refund helper exists, called from Prisma Studio for now.
- Webhook signature: not available; lookup-API verification is the substitute.
