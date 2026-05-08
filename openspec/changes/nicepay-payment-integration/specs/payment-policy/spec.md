## ADDED Requirements

### Requirement: Single-source pricing constants
Pro plan prices SHALL be sourced from environment variables `PRICE_PRO_MONTH_KRW` and `PRICE_PRO_YEAR_KRW`, validated at server boot via zod, and exposed to clients only through `paymentRouter.getPricing`.

#### Scenario: Missing price env fails fast
- **WHEN** the server starts without `PRICE_PRO_MONTH_KRW`
- **THEN** boot MUST throw a configuration error and the process MUST exit non-zero

#### Scenario: Hardcoded price forbidden
- **WHEN** running the build/grep guard test
- **THEN** the literals `19900` and `199000` MUST NOT appear in any source file outside `src/lib/payments/pricing.ts` and `.env.example`

### Requirement: Refund window 7 days, usage 0
Self-serve refund eligibility SHALL be `Payment.paidAt >= now() - 7d` AND `Subscription.dailyGenerations + monthlyVectorizes for the current period === 0`. Admins SHALL bypass these gates.

#### Scenario: Day 8 self-refund blocked
- **WHEN** a user requests a refund 8 days after `paidAt`
- **THEN** the request MUST fail with `tRPC FORBIDDEN` and code `refund_window_expired`

#### Scenario: Admin bypasses both gates
- **WHEN** an admin requests a refund 30 days after paidAt with usage > 0
- **THEN** the request MUST proceed and an AuditLog entry MUST be written

### Requirement: Cancellation keeps period access
A canceled subscription SHALL retain Pro features until the existing `periodEnd`, after which the cron transitions it to `expired` and downgrades the user to `free`.

#### Scenario: Mid-period cancel
- **WHEN** a user cancels on day 10 of a 30-day period
- **THEN** Pro features MUST remain available through day 30, and `nextBillingDate` MUST be cleared so no further auto-charge occurs

### Requirement: No free trial
The system SHALL NOT offer free trials, time-limited Pro previews, or partial Pro access prior to a successful first payment.

#### Scenario: Trial flag absent
- **WHEN** any code path attempts to set `Subscription.tier='pro'` without a corresponding `Payment.status='paid'`
- **THEN** the tier-write-allowlist test MUST fail and the change MUST be rejected at CI

### Requirement: Recurring billing payment method restriction
Billing-key issuance for recurring billing SHALL be limited to credit cards. Other methods (vbank, bank, kakaopay, naverpay, easypay, cellphone) MAY be used for one-time payments only and MUST NOT be offered in the upgrade UI.

#### Scenario: Non-card billing-key issuance blocked
- **WHEN** any code attempts to call NICE billing-key issuance with a method other than `card`
- **THEN** the call MUST throw before the network request and surface error code `billing_key_card_only`
