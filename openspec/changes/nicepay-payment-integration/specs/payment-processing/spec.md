## ADDED Requirements

### Requirement: PG-neutral payment provider boundary
The system SHALL expose payment behavior through a PG-neutral `ProviderPaymentResult` interface so that NICE Payments-specific logic is isolated to `src/lib/nicepay/**` and the billing core (`record-payment.ts`, `state-machine.ts`) consumes only the neutral interface.

#### Scenario: Billing core receives provider-neutral input
- **WHEN** any payment outcome is recorded (return URL approval, cron billing, webhook, refund)
- **THEN** the call site MUST translate the NICE response into `ProviderPaymentResult { orderId, providerPaymentId, providerTransactionId?, status, amount, currency, errorCode?, errorMessage?, receiptUrl?, paymentMethod, paidAt? }` before invoking `recordPaymentResult`

#### Scenario: NICE-specific code is not imported by billing core
- **WHEN** running the lint/grep guard test
- **THEN** files under `src/lib/billing/**` MUST NOT import from `src/lib/nicepay/**`

### Requirement: Server approval model with Basic auth
The system SHALL approve every NICE Payments transaction by issuing `POST https://{api-base}/v1/payments/{tid}` from the server with `Authorization: Basic base64(NICEPAY_CLIENT_ID:NICEPAY_SECRET_KEY)` after validating the return-URL signature and amount, and SHALL never expose `NICEPAY_SECRET_KEY` to the browser.

#### Scenario: Approval call uses Basic auth
- **WHEN** the return URL handler invokes the approval API
- **THEN** the request MUST include `Authorization: Basic <base64>` and MUST NOT include any token-based auth header

#### Scenario: SecretKey isolation
- **WHEN** the client bundle is built
- **THEN** `NICEPAY_SECRET_KEY` MUST NOT appear in any client-side bundle (verified by build-time grep guard)

### Requirement: Pre-allocated orderId and pending Payment record
The system SHALL allocate a unique `orderId` matching `^splash_[A-Za-z0-9]{8}_\d{10}_[A-Za-z0-9]{4}$` and create a `Payment` row with `status='pending'` BEFORE opening the NICE checkout window, and SHALL enforce uniqueness via a database constraint.

#### Scenario: Checkout session creates pending payment
- **WHEN** `paymentRouter.createCheckoutSession` is called by an authenticated user
- **THEN** the server MUST insert a `Payment` row with the new `orderId`, `status='pending'`, expected `amount`, target `tier`, and target `periodStart/periodEnd` inside a single Prisma transaction
- **AND** return `{ orderId, amount, goodsName, returnUrl, jsSdkUrl, clientId, currency: 'KRW' }` to the client

#### Scenario: Duplicate orderId rejected by DB
- **WHEN** a duplicate orderId reaches the DB
- **THEN** the unique constraint on `Payment.orderId` MUST raise an error and the request MUST fail with HTTP 409

### Requirement: Return URL signature and amount validation before approval
The system SHALL receive NICE checkout results at `POST /api/payments/nicepay/return` (form-urlencoded), and SHALL reject the request before calling the approval API if any of the following fail: signature mismatch, amount mismatch with the pending Payment row, missing/expired authToken, or unknown orderId.

#### Scenario: Signature validation
- **WHEN** the return URL handler receives `authToken, clientId, amount, ediDate, signature` from NICE
- **THEN** the handler MUST recompute `sha256(authToken + clientId + amount + ediDate + NICEPAY_SECRET_KEY)` and compare with `signature` using a timing-safe equal
- **AND** on mismatch, MUST respond with HTTP 400, log a security event, and not call the approval API

#### Scenario: Amount tampering rejected
- **WHEN** the NICE-supplied `amount` does not equal the `amount` of the pending Payment row identified by `orderId`
- **THEN** the handler MUST mark the Payment row `status='failed'` with `errorCode='amount_mismatch'`, MUST NOT call the approval API, and MUST redirect to `/account/payments?status=failed&reason=amount_mismatch`

#### Scenario: Successful approval transition
- **WHEN** signature and amount validate AND the approval API returns `resultCode='0000'`
- **THEN** the handler MUST update the Payment row to `status='paid'` with `providerPaymentId=tid`, `paidAt=now()`, `receiptUrl`, and call `recordPaymentResult` inside the same Prisma transaction
- **AND** redirect to `/account/payments?status=success&orderId={orderId}` via HTTP 303

### Requirement: Cancellation API for refunds and reversals
The system SHALL invoke `POST /v1/payments/{tid}/cancel` with `signData=sha256(tid + ediDate + NICEPAY_SECRET_KEY)` for both full and partial refunds, and SHALL update Payment status to `refunded` (full) or `partial_refunded` (partial) only after a successful NICE response.

#### Scenario: Full refund request
- **WHEN** an admin or eligible user requests a full refund through `paymentRouter.requestRefund`
- **THEN** the system MUST call NICE cancel with no `cancelAmt`, set `Payment.status='refunded'`, set `Subscription.billingState='free'` if it was the active period, and dispatch a refund email

#### Scenario: NICE cancel API failure
- **WHEN** the NICE cancel API responds with non-zero `resultCode`
- **THEN** the system MUST keep Payment.status unchanged, surface the NICE `resultMsg` as the tRPC error, and not transition the subscription state

### Requirement: Idempotent payment recording keyed by orderId
The system SHALL treat `Payment.orderId` as the idempotency key. Recording the same `(orderId, status)` outcome twice MUST NOT create duplicate rows, duplicate state transitions, or duplicate emails.

#### Scenario: Duplicate webhook of paid event
- **WHEN** the same `paid` outcome is delivered twice (e.g., return URL + webhook)
- **THEN** `recordPaymentResult` MUST detect the existing Payment row and short-circuit without re-firing the state machine or emails

### Requirement: AES-256-CBC encData for billing key issuance
The system SHALL build the billing-key issuance plaintext as `cardNo=...&expYear=YY&expMonth=MM&idNo=...&cardPw=...`, encrypt it with AES-256-CBC using `key=NICEPAY_SECRET_KEY (32B)`, `iv=NICEPAY_SECRET_KEY[0..16]`, PKCS5 padding, and Hex-encode the result; the plaintext buffer MUST be zeroized after use, and no card-data field MAY ever be persisted to the database.

#### Scenario: Card data never written to DB
- **WHEN** the billing-key issuance flow runs
- **THEN** the only fields persisted to `BillingKey` are `bid`, `last4`, `cardBrand`, `userId`, `subscriptionId`, `isActive`, `issuedAt`
- **AND** searching the DB for `cardNo`, `cardPw`, `idNo`, `expYear`, or `expMonth` MUST return zero matches

### Requirement: Mode and base URL gating
The system SHALL select the NICE API base URL solely from `NICEPAY_MODE` (defaults to `test`) and SHALL refuse to start in `live` mode unless `NODE_ENV='production'` AND `VERCEL_ENV='production'`.

#### Scenario: Live mode blocked outside production
- **WHEN** `NICEPAY_MODE=live` and `VERCEL_ENV !== 'production'`
- **THEN** server bootstrap MUST throw a configuration error before serving any request
