## ADDED Requirements

### Requirement: Idempotent webhook intake
The system SHALL accept NICE webhooks at `POST /api/webhooks/nicepay` (Node runtime), validate `signData`, and persist a `WebhookEvent { eventId @unique, type, payload, receivedAt, processedAt }` row before any side effects; duplicate `eventId` MUST result in HTTP 200 with no side effects.

#### Scenario: First delivery processes
- **WHEN** NICE sends a webhook with a fresh `eventId`
- **THEN** the handler validates `signData`, inserts a `WebhookEvent` row, dispatches the type-specific handler, sets `processedAt`, and returns HTTP 200 within 5 seconds

#### Scenario: Replay returns 200 without side effects
- **WHEN** NICE retries with the same `eventId`
- **THEN** the unique constraint MUST short-circuit the handler and return HTTP 200 immediately, with no additional state transitions, emails, or external API calls

#### Scenario: Invalid signData rejected
- **WHEN** `signData` does not match `sha256(tid + amount + ediDate + NICEPAY_SECRET_KEY)` (or the type-specific formula)
- **THEN** the handler MUST return HTTP 400 and persist a `WebhookEvent` with `processingError='invalid_signature'`

### Requirement: Vbank deposit completion
The system SHALL handle vbank deposit-completed webhooks by transitioning the matching pending Payment to `status='paid'`, calling `recordPaymentResult`, and dispatching the success email — even if the user never returned to the return URL.

#### Scenario: Deposit before return URL
- **WHEN** the user pays via vbank and the deposit-completed webhook arrives before any return URL hit
- **THEN** the Payment becomes `paid`, the Subscription transitions according to the state machine, and the user sees a paid status the next time they open `/account/payments`

### Requirement: Vbank expiry
The system SHALL handle vbank-expired webhooks by transitioning the matching pending Payment to `status='vbank_expired'` (no Subscription change) and dispatching an expiry email.

#### Scenario: Vbank not paid in time
- **WHEN** the vbank account expires without a deposit
- **THEN** the Payment row is updated to `vbank_expired`, the Subscription remains in its prior state, and the user receives an email explaining how to retry

### Requirement: Out-of-band cancellation
The system SHALL handle cancellation webhooks (e.g., NICE-side or admin-tool-driven cancels) by transitioning the matching Payment to `refunded` or `partial_refunded`, and applying the appropriate Subscription state transition through `recordPaymentResult`.

#### Scenario: Cancel webhook synchronizes DB
- **WHEN** an out-of-band cancel webhook arrives for a paid Payment
- **THEN** the system MUST update Payment status, recompute the Subscription state via the state machine, and dispatch the corresponding email (refund or downgrade)

### Requirement: Recurring charge backup sync
The system SHALL accept recurring-charge-result webhooks as a backup for the cron, with the same idempotency guarantees so that cron + webhook double-delivery never produces duplicate Payments or emails.

#### Scenario: Webhook arrives before cron commits
- **WHEN** the recurring-charge-result webhook for `(orderId)` arrives before the cron's local DB commit
- **THEN** the unique `Payment.orderId` constraint MUST cause exactly one row to be created and one state transition to fire
