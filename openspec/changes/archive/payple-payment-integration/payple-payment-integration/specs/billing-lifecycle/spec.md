## ADDED Requirements

### Requirement: Subscription billing state machine
A `Subscription` SHALL exist in exactly one of these states at any time, derived from `tier`, `canceledAt`, `nextBillingDate`, and `failedRetryCount`:

| State           | Condition                                                            |
|-----------------|----------------------------------------------------------------------|
| `free`          | `tier="free"` and no active billing key                              |
| `active`        | `tier="pro"`, `canceledAt IS NULL`, `failedRetryCount < 3`            |
| `pending_retry` | `tier="pro"`, `canceledAt IS NULL`, `failedRetryCount IN (1,2)`       |
| `canceled_grace`| `tier="pro"`, `canceledAt IS NOT NULL`, `nextBillingDate > now()`    |
| `expired`       | `tier="free"` and `canceledAt IS NOT NULL` (just-downgraded)         |

The system SHALL NOT directly write `tier="pro"` outside of payment-processing or admin-procedure paths.

#### Scenario: First successful charge transitions to active
- **WHEN** a `free` user's first charge succeeds
- **THEN** the subscription becomes `active` with `tier="pro"`, `nextBillingDate=now+1mo`, `failedRetryCount=0`

#### Scenario: User cancels while active
- **WHEN** an `active` user invokes `payment.cancelSubscription`
- **THEN** the subscription becomes `canceled_grace` with `canceledAt=now()` and `tier="pro"` preserved

### Requirement: Daily renewal cron
The system SHALL run a Vercel Cron job at `0 15 * * *` UTC (00:00 KST) hitting `GET /api/cron/billing` with header `Authorization: Bearer ${CRON_SECRET}`. The handler SHALL:
1. Reject any request lacking the bearer token.
2. Find subscriptions where `tier="pro" AND nextBillingDate <= now() AND billingKeyType="domestic_card"`.
3. For each, attempt a charge in a transaction keyed by `(subscriptionId, billingPeriodStart=nextBillingDate)` so re-runs are idempotent.
4. Process at most 200 subscriptions per invocation; remaining due rows are picked up the next day.

#### Scenario: Cron requires bearer auth
- **WHEN** `/api/cron/billing` is called without the header
- **THEN** the route returns 401 and processes nothing

#### Scenario: Idempotent re-run within the same period
- **WHEN** the cron runs twice for the same `(subscriptionId, billingPeriodStart)`
- **THEN** only one `Payment` row is created (unique index)

#### Scenario: International subscriptions are skipped
- **WHEN** the cron encounters a row with `billingKeyType="international_card"`
- **THEN** the row is skipped and an `Invoice` row with `status="pending_user_action"` is upserted

### Requirement: Three-strike retry policy
On charge failure, the system SHALL increment `Subscription.failedRetryCount` and schedule the next attempt by setting a virtual `nextBillingDate` according to: 1st failure → +1 day, 2nd failure → +3 days, 3rd failure → auto-downgrade. On the 3rd failure the system SHALL set `tier="free"`, `canceledAt=now()`, `cancelReason="auto_after_3_failures"`, deactivate the billing key, and emit the auto-downgrade email.

#### Scenario: First failure schedules retry in 1 day
- **WHEN** a charge fails for an `active` subscription with `failedRetryCount=0`
- **THEN** `failedRetryCount=1` and `nextBillingDate=now+1day`

#### Scenario: Third failure auto-downgrades
- **WHEN** the 3rd retry fails
- **THEN** `tier="free"`, `canceledAt=now()`, `cancelReason="auto_after_3_failures"`
- **AND** the active billing key's `isActive=false`
- **AND** an auto-downgrade email is queued

### Requirement: User-initiated cancellation with grace
The tRPC procedure `payment.cancelSubscription` SHALL set `canceledAt=now()` and `cancelReason=<user-provided>` but SHALL keep `tier="pro"` and `nextBillingDate` unchanged. The cron SHALL flip `tier="free"` only when `now() >= nextBillingDate AND canceledAt IS NOT NULL`.

#### Scenario: Cancellation preserves access until period end
- **WHEN** a user cancels on Day 5 of a 30-day cycle
- **THEN** their tier remains `pro` for 25 more days

#### Scenario: Grace expiry on the cron run
- **WHEN** `now() >= nextBillingDate` for a `canceled_grace` subscription
- **THEN** the cron sets `tier="free"` and emits the cancellation-confirmation email

### Requirement: Manual immediate charge
The tRPC procedure `payment.chargeNow` SHALL allow a `pending_retry` user to retry their failed charge immediately. The procedure SHALL be a no-op for `active` users.

#### Scenario: Pending-retry user retries successfully
- **WHEN** a `pending_retry` user invokes `chargeNow` and Payple returns success
- **THEN** the subscription becomes `active`, `failedRetryCount=0`, `nextBillingDate=now+1mo`

#### Scenario: Active user gets a no-op
- **WHEN** an `active` user invokes `chargeNow`
- **THEN** the procedure returns `{ status: "already_active" }` and makes no Payple call
