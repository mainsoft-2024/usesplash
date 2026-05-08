## ADDED Requirements

### Requirement: Card-only billing key issuance
The system SHALL issue NICE billing keys (`bid`) for credit cards only, and SHALL NOT offer billing-key issuance for vbank, kakaopay, or other non-card methods.

#### Scenario: Pro upgrade issues card billing key
- **WHEN** an authenticated user completes the first Pro payment via the NICE checkout window
- **THEN** the server MUST issue a billing key with `encMode='A2'`, store `BillingKey { bid, last4, cardBrand, userId, subscriptionId, isActive=true }`, and link it to the user's `Subscription.activeBillingKeyId`

#### Scenario: Non-card method rejected for billing key
- **WHEN** the upgrade flow detects a non-card method
- **THEN** the system MUST surface "Pro 정기결제는 신용카드만 지원해요" and not attempt billing-key issuance

### Requirement: Pricing and billing cycles
The system SHALL offer Pro plan at 19,900원/월 (KRW VAT included) and 199,000원/년 (10× monthly price). The pricing source of truth SHALL be `PRICE_PRO_MONTH_KRW` and `PRICE_PRO_YEAR_KRW` env vars, validated at server boot.

#### Scenario: Pricing displayed on /pricing
- **WHEN** a user opens `/pricing`
- **THEN** the page MUST display "19,900원/월" and "199,000원/년 (2개월 할인)" derived from server-provided values, with a monthly/annual toggle

#### Scenario: Plan amount drives orderId charge
- **WHEN** `createCheckoutSession` is called with `plan='monthly'` or `plan='yearly'`
- **THEN** the resulting Payment row's `amount` MUST equal the env-driven price for that plan, and the same amount MUST be sent to NICE

### Requirement: Daily billing cron with retry policy
The system SHALL run `GET /api/cron/billing` daily at 00:10 KST (Vercel cron `0 15 * * *` UTC), gated by `Authorization: Bearer ${CRON_SECRET}`, charging every Subscription whose `billingState='active'` AND `nextBillingDate <= now()` via NICE billing-key approval.

#### Scenario: Successful renewal
- **WHEN** the cron processes an eligible subscription and NICE returns `resultCode='0000'`
- **THEN** an Invoice row is upserted on `(subscriptionId, periodStart)`, the Payment row is created with `status='paid'`, `Subscription.nextBillingDate` advances by one cycle (1 month or 1 year), `failedRetryCount` resets to 0, and a payment-success email is dispatched

#### Scenario: Failed renewal triggers retry
- **WHEN** NICE returns a non-zero `resultCode` (e.g., insufficient funds, expired card)
- **THEN** `failedRetryCount` is incremented, `Subscription.billingState` becomes `pending_retry`, `nextBillingDate` is rescheduled by 1, 3, or 7 days based on attempt count, a payment-failure email is dispatched, and the system MUST NOT downgrade until the retry policy is exhausted

#### Scenario: Retries exhausted enters grace
- **WHEN** the third retry attempt fails (`failedRetryCount === 3`)
- **THEN** `billingState` transitions to `canceled_grace` with `cancelEffectiveAt = now() + 7 days`, `nextBillingDate=null`, and an auto-downgrade email is queued for the grace expiry

#### Scenario: Cron is idempotent
- **WHEN** the cron runs twice for the same `(subscriptionId, periodStart)` window
- **THEN** the unique constraint on `Invoice(subscriptionId, periodStart)` and `Payment.orderId` MUST prevent duplicate charges

### Requirement: Cancel and uncancel
The system SHALL allow a user to cancel an active subscription, which moves the subscription to `canceled_grace` with `cancelEffectiveAt = current periodEnd` and `nextBillingDate=null` (no further auto-charges); the user SHALL be able to undo cancellation up to `cancelEffectiveAt`.

#### Scenario: Cancel keeps access until period end
- **WHEN** a Pro user calls `paymentRouter.cancelSubscription`
- **THEN** the user MUST retain Pro features until the current `periodEnd`, after which the cron transitions the subscription to `expired` and downgrades to `free`

#### Scenario: Uncancel restores active before deadline
- **WHEN** the user calls `paymentRouter.uncancelSubscription` before `cancelEffectiveAt`
- **THEN** `billingState='active'`, `cancelEffectiveAt=null`, and `nextBillingDate` is restored to the original next-cycle date

### Requirement: Refund eligibility (self-serve)
The system SHALL allow self-serve full refund only when ALL of the following hold: the original Payment was made within the last 7 days, the user's daily generation usage in the current billing period is exactly 0, and the subscription is still in the same billing period as the Payment.

#### Scenario: Eligible self-serve refund succeeds
- **WHEN** all eligibility conditions are met
- **THEN** the system calls NICE cancel, sets `Payment.status='refunded'`, transitions `Subscription` to `free` immediately, and emails a refund confirmation

#### Scenario: Used-the-product blocks refund
- **WHEN** the user has any generation usage > 0 in the current period
- **THEN** the refund request MUST fail with `tRPC FORBIDDEN` and message "사용 이력이 있어 환불이 불가합니다. 고객지원으로 문의해주세요."

### Requirement: Admin manual operations
Admin users SHALL have privileged operations: arbitrary refund (full/partial) regardless of self-serve eligibility, manual billing-key expire (force unsubscribe), and reading the full payment history of any user. These operations SHALL be logged to an `AuditLog` table.

#### Scenario: Admin partial refund
- **WHEN** an admin calls `paymentRouter.requestRefund` with `cancelAmt < amount`
- **THEN** the system MUST call NICE cancel with the partial amount, set `Payment.status='partial_refunded'`, persist remaining/refunded amounts, and write an `AuditLog` entry with `actorId, targetUserId, action='partial_refund', amount, reason`

#### Scenario: Admin manually expires billing key
- **WHEN** an admin calls `paymentRouter.expireBillingKey(userId)`
- **THEN** the system calls NICE billing-key expire, sets `BillingKey.isActive=false`, transitions Subscription to `canceled_grace` with `cancelEffectiveAt=current periodEnd`, and writes an `AuditLog` entry
