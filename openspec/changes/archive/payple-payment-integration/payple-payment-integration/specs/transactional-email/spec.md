## ADDED Requirements

### Requirement: Resend client
The system SHALL provide `src/lib/email/client.ts` exporting a `sendEmail({ to, subject, react })` helper that wraps `resend.emails.send`. The client SHALL read `RESEND_API_KEY` and `EMAIL_FROM` from env at module load. If either is missing, the helper SHALL log a warning and return `{ skipped: true }` instead of throwing — payment processing MUST never fail because email is unavailable.

#### Scenario: Email is sent in production
- **WHEN** `RESEND_API_KEY` and `EMAIL_FROM` are set and `sendEmail` is invoked
- **THEN** Resend's API is called and the helper returns `{ id: <resend-id> }`

#### Scenario: Missing env does not block payment flow
- **WHEN** `RESEND_API_KEY` is unset and a payment succeeds
- **THEN** the payment is committed, `sendEmail` returns `{ skipped: true }`, and no exception propagates

### Requirement: React Email templates
The system SHALL provide four React Email templates under `src/lib/email/templates/`:
- `PaymentSuccessEmail({ amount, currency, receiptUrl, nextBillingDate })`
- `PaymentFailureEmail({ amount, currency, attempt, nextRetryDate, manualPayUrl })`
- `CancellationEmail({ accessEndDate })`
- `AutoDowngradeEmail({ failureReason, reUpgradeUrl })`

All templates SHALL extend a shared `BaseLayout` component with the Splash logo and footer. Subjects SHALL be localized to Korean for KRW payments and English for USD payments.

#### Scenario: KRW payment uses Korean subject
- **WHEN** a KRW payment success email is sent
- **THEN** the subject equals "결제가 완료되었습니다 - Splash Pro"

#### Scenario: USD payment uses English subject
- **WHEN** a USD payment success email is sent
- **THEN** the subject equals "Payment received - Splash Pro"

### Requirement: Email triggering rules
The system SHALL send emails at these moments:

| Trigger                                | Template               |
|----------------------------------------|------------------------|
| `Payment.status` becomes `completed`   | `PaymentSuccessEmail`  |
| `Payment.status` becomes `failed`      | `PaymentFailureEmail`  |
| `cancelSubscription` succeeds          | `CancellationEmail`    |
| Subscription is auto-downgraded after 3 failures | `AutoDowngradeEmail` |

Emails SHALL be queued via a fire-and-forget call from the same transaction handler — if the DB commit fails, no email is sent.

#### Scenario: Successful charge sends success email
- **WHEN** the recurring charge cron commits a `Payment` with `status="completed"`
- **THEN** a `PaymentSuccessEmail` is dispatched to the user's email

#### Scenario: Rolled-back transaction sends no email
- **WHEN** the DB transaction throws after Payple returned success
- **THEN** no email is sent (because the dispatch happens after commit)
