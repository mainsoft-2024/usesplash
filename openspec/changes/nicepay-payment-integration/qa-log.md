# QA Log — nicepay-payment-integration

Recorded by mad-agent during the apply session on 2026-05-08.

## Automated verification (in-session)

| Command | Scope | Result |
|---|---|---|
| `pnpm exec tsc --noEmit` | Full repo | 0 errors in `src/**` (NICE scope). Pre-existing errors only in `packages/slash-ai-cli/**` (Bun:test typings) — unrelated. |
| `pnpm exec vitest run src/lib/nicepay src/lib/billing src/lib/email src/lib/payments src/server/routers/payment src/app/api` | NICE scope | **101/101 passing** |
| `pnpm exec eslint <NICE files>` | NICE scope | **clean (0 errors, 0 warnings)** |
| `pnpm exec vitest run src/` | Whole src/ | 201 passing, 2 failing — both in `src/server/routers/admin-insights.test.ts` and were **already broken before this change** (verified with `git stash` baseline run). Unrelated to NICE. |
| `npx prisma migrate dev` / `db push` | Neon dev DB | Schema synced. Migration `20260508090501_nicepay_pg_neutral_rename` applied. Subsequent additions (`Payment.amount`, `Payment.currency`, `Payment.paymentMethod`, `Invoice.paymentId @unique`) applied via `prisma db push` (no destructive changes). |
| `openspec validate nicepay-payment-integration --strict` | OpenSpec | **valid** |

## Tests count breakdown by section

- §3 NICE core lib: 11 tests (signature, crypto, auth, order-id, adapter, errors)
- §4 billing core: 40 tests (record-payment, state-machine, tier-write-allowlist, no-nicepay-import)
- §5 tRPC payment router: 1 test (happy-path scaffold)
- §6 return URL handler: 2 tests (happy + auth fail)
- §7 webhook handler: 7 tests (full matrix)
- §8 cron billing: 1 test (auth gate)
- §10 email: 9 tests (templates render, dispatcher snapshot)

**Note on §5/§6/§8 test depth.** The full test matrix specified in tasks.md (12/7/9 cases respectively) was not implemented in this session. Implementation logic was verified through type-checking and integration via §7 (which calls into the same record-payment + adapter paths). Expanding these matrices is a follow-up task — see [Outstanding work](#outstanding-work).

## Manual sandbox QA — NOT YET PERFORMED

The following items require external coordination and are blocked on user action; they are intentionally left unchecked in tasks.md:

- 11.2 Manual sandbox QA matrix
  - Card: success / signature mismatch / amount mismatch / NICE 4xx
  - Vbank: webhook deposit / expiry
  - Billing key: issue / approve / expire
  - Refund: self-serve eligible / blocked / admin partial
  - Cron: renewal / retry escalation / grace expiry
  - Cancel/uncancel UX
- 11.3 Register webhook URL `https://usesplash.vercel.app/api/webhooks/nicepay` on the NICE merchant console
- 11.4 Vercel: register cron, set test env vars, deploy preview, run sandbox QA on preview
- 11.5 Production canary (single internal account, real Pro payment, immediate refund)
- 11.6 Flip `NEXT_PUBLIC_PAYMENTS_ENABLED=true` in production after canary success
- 9.7 E2E test (Playwright harness exists; test not authored in this session)

## Outstanding work (recommended before public launch)

1. Expand vitest matrix for §5 (`paymentRouter`), §6 (return route), §8 (cron) per the original tasks.md acceptance criteria.
2. Author the §9.7 Playwright e2e test using the existing `e2e/` harness.
3. Wire `UpgradeCta` into the dashboard layout (component is built and exported but currently has no caller).
4. Decide on copy for `/terms` and `/refund-policy` pages (linked from the pricing CTA disclaimer).
5. Once NICE merchant credentials are issued, perform sandbox QA matrix (item 11.2) and append results to this file.

## Environment readiness checklist

When NICE keys arrive, set these in Vercel for **all** environments (development, preview, production):

```
NICEPAY_MODE=test        # flip to "live" only after canary
NICEPAY_CLIENT_ID=...
NICEPAY_SECRET_KEY=...   # MUST be exactly 32 bytes (NICE issues this length)
NICEPAY_API_BASE=https://api.nicepay.co.kr
NICEPAY_JS_SDK_URL=https://pay.nicepay.co.kr/v1/js/
PRICE_PRO_MONTH_KRW=19900
PRICE_PRO_YEAR_KRW=199000
CRON_SECRET=<openssl rand -base64 32>
NEXT_PUBLIC_PAYMENTS_ENABLED=false   # flip to "true" only after 11.5 canary success
```

For local development, `.env` is populated via `npx vercel env pull .env --environment=production` (already done in this session for the existing keys; NICE keys need to be added in Vercel first, then re-pulled).
