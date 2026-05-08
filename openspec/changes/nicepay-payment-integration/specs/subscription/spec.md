## MODIFIED Requirements

### Requirement: Manual subscription management
Tier transitions SHALL be writable from a closed allowlist of code paths only:
1. `src/lib/billing/record-payment.ts` (driven by `ProviderPaymentResult`),
2. `src/server/routers/subscription.ts#adminUpdateTier` (admin-only),
3. `src/app/api/cron/billing/route.ts` (renewal/grace/expiry cron),
4. `src/app/api/payments/nicepay/return/route.ts` (server approval result),
5. `src/app/api/webhooks/nicepay/route.ts` (vbank deposit, recurring result, out-of-band cancel).

All other code paths SHALL be forbidden from writing `Subscription.tier` and the prohibition SHALL be enforced by `tier-write-allowlist.test.ts`.

#### Scenario: Admin upgrades user
- **WHEN** an admin changes a user's tier from Free to Pro on the admin page
- **THEN** the user's subscription record is updated and new limits apply immediately

#### Scenario: Payment-driven upgrade
- **WHEN** the return URL handler successfully approves a Pro payment via NICE
- **THEN** `recordPaymentResult` transitions the subscription from `free` to `active` (Pro), sets `periodStart`, `periodEnd`, `nextBillingDate`, and `activeBillingKeyId`, and dispatches the success email

#### Scenario: Disallowed write path rejected
- **WHEN** any source file outside the allowlist contains `Subscription.update({ tier: ... })`-like writes
- **THEN** the allowlist grep test MUST fail at CI

## ADDED Requirements

### Requirement: PG-neutral subscription fields
The `Subscription` model SHALL expose the following PG-neutral fields, replacing the previous Payple-prefixed names:
- `activeBillingKeyId` (FK → BillingKey),
- `paymentMethod` (`card` for now),
- `currency` (`KRW`),
- `periodStart`, `periodEnd`, `nextBillingDate`, `failedRetryCount`, `cancelEffectiveAt`, `cancelReason`,
- `billingState` enum: `free | active | pending_retry | canceled_grace | expired`.

#### Scenario: No PG-prefixed fields remain
- **WHEN** running the schema lint test
- **THEN** the Prisma schema MUST NOT contain any column named with `payple*`, `nice*`, or other PG-specific prefixes for cross-PG concepts (NICE-specific identifiers `bid`, `tid` MAY exist on `BillingKey`/`Payment` as `bid` and `providerTransactionId`)

### Requirement: Pro tier billing cycles
The system SHALL support `monthly` and `yearly` Pro plans with `periodEnd = periodStart + 30 days` (monthly) or `+ 365 days` (yearly), and `nextBillingDate = periodEnd` on success.

#### Scenario: Monthly cycle advances
- **WHEN** a monthly Pro renewal succeeds on `2026-05-08`
- **THEN** `periodStart = 2026-05-08`, `periodEnd = 2026-06-07`, `nextBillingDate = 2026-06-07`

#### Scenario: Yearly cycle advances
- **WHEN** a yearly Pro renewal succeeds on `2026-05-08`
- **THEN** `periodStart = 2026-05-08`, `periodEnd = 2027-05-08`, `nextBillingDate = 2027-05-08`

### Requirement: Billing state machine integration
Subscription state transitions SHALL be driven exclusively by `src/lib/billing/state-machine.ts` consuming `BillingEvent` (`charge_succeeded | charge_failed | user_canceled | user_uncanceled | grace_expired | refunded`), and the state machine MUST remain free of any NICE Payments imports.

#### Scenario: State machine PG-agnostic
- **WHEN** running the import-graph guard test
- **THEN** `src/lib/billing/state-machine.ts` MUST NOT import from `src/lib/nicepay/**` or `@/lib/nicepay`
