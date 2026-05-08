## ADDED Requirements

### Requirement: Payple test/live mode selection
The system SHALL select the Payple environment based on the `PAYPLE_MODE` env var, defaulting to `test`. When `PAYPLE_MODE=test` the system SHALL use `democpay.payple.kr` (domestic) and `demo-api.payple.kr` (global). When `PAYPLE_MODE=live` the system SHALL use `cpay.payple.kr` and `api.payple.kr` and SHALL refuse to start if the corresponding `PAYPLE_LIVE_*` env vars are missing.

#### Scenario: Test mode is the default
- **WHEN** `PAYPLE_MODE` is unset
- **THEN** all Payple HTTP calls target `democpay.payple.kr` / `demo-api.payple.kr`
- **AND** the system uses the test cpid / service_id from env

#### Scenario: Live mode requires live secrets
- **WHEN** `PAYPLE_MODE=live` and `PAYPLE_LIVE_CST_ID` is missing
- **THEN** Next.js boot logs a fatal error and the Payple client throws on first call

### Requirement: Partner authentication proxy
The system SHALL expose `POST /api/payple/auth` that accepts `{ workType: "AUTH" | "CERT" | "PAYM" | "PAYC", region: "domestic" | "global" }` from authenticated tRPC sessions only, calls Payple's auth endpoint server-side, and returns the auth token fields (`PCD_CST_ID`, `PCD_CUST_KEY`, `PCD_AUTH_KEY` for domestic; `access_token` for global). The route MUST never echo the raw `custKey` / `service_key` to the client.

#### Scenario: Domestic auth for billing-key issuance
- **WHEN** an authenticated user POSTs `{ workType: "AUTH", region: "domestic" }`
- **THEN** the route calls `POST {base}/php/auth.php` with `{ cst_id, custKey, PCD_PAY_WORK: "AUTH" }`
- **AND** returns the three auth fields plus `clientKey` (which is safe to expose) to the client

#### Scenario: Unauthenticated request rejected
- **WHEN** an anonymous request POSTs to `/api/payple/auth`
- **THEN** the route returns 401 and makes no upstream call

### Requirement: Order ID generation
The system SHALL generate `PCD_PAY_OID` values using the format `splash_{userIdShort}_{epochSeconds}` where `userIdShort` is the first 8 chars of the cuid (lowercase alphanumeric). The total length SHALL NOT exceed 40 characters. Two calls within the same second for the same user SHALL append a 2-digit suffix.

#### Scenario: Standard order ID
- **WHEN** user `cl9k8z2x40000abcd1234` initiates checkout at epoch `1745692800`
- **THEN** the order ID equals `splash_cl9k8z2x_1745692800`

#### Scenario: Sub-second collision
- **WHEN** the same user initiates two checkouts in the same epoch second
- **THEN** the second call appends a `_01` suffix

### Requirement: Domestic billing-key issuance
The system SHALL issue domestic billing keys via Payple's `PCD_PAY_WORK=AUTH` flow with `PCD_CARD_VER=01` (recurring). On successful return of `PCD_PAYER_ID`, the system SHALL persist a `BillingKey` row with `type="domestic_card"` and `isActive=true`, and update `Subscription.billingKey` and `billingKeyType`.

#### Scenario: Successful billing-key issuance
- **WHEN** Payple result-callback POSTs `{ PCD_PAY_RST: "success", PCD_PAYER_ID: "OVA3..." }`
- **THEN** a `BillingKey` row is inserted with `payerId="OVA3..."`, `type="domestic_card"`, `userId=<session>`
- **AND** `Subscription.billingKey="OVA3..."`, `billingKeyType="domestic_card"`, `paymentMethod="card"`

#### Scenario: User already has an active billing key
- **WHEN** a user with an active billing key issues a new one
- **THEN** the previous `BillingKey.isActive` is set to `false`
- **AND** `Subscription.billingKey` is overwritten with the new payer id

### Requirement: Domestic recurring charge
The system SHALL charge a stored domestic billing key via `POST {base}/php/SimplePayCardAct.php?ACT_=PAYM` with `PCD_PAYER_ID`, `PCD_PAY_TOTAL`, `PCD_PAY_GOODS`, and a freshly-issued `PCD_PAY_OID`. On `PCD_PAY_RST=success` the system SHALL insert a `Payment` row with `status="completed"`, persist `PCD_PAY_CARDRECEIPT` as `receiptUrl`, and bump `Subscription.nextBillingDate` by 1 month.

#### Scenario: Successful recurring charge
- **WHEN** the cron handler calls `chargeDomestic(payerId, 9900)` and Payple returns success
- **THEN** a `Payment` row is inserted with `amount=9900`, `currency="KRW"`, `status="completed"`, `receiptUrl=<url>`
- **AND** `Subscription.nextBillingDate` advances by exactly 1 month
- **AND** `Subscription.failedRetryCount` is reset to 0

#### Scenario: Charge fails with declined card
- **WHEN** Payple returns `PCD_PAY_RST=error` with code `PAYC0010`
- **THEN** a `Payment` row is inserted with `status="failed"`, `errorCode="PAYC0010"`
- **AND** `nextBillingDate` is NOT advanced
- **AND** `failedRetryCount` is incremented

### Requirement: International one-shot charge
The system SHALL perform international card charges via Payple Global with `service_id` + bearer-token auth, using `currency="USD"` and `totalAmount=PRICE_PRO_MONTH_USD`. The first release SHALL treat international charges as one-shot only — no automatic recurring. Issued global `billing_key` values MAY be persisted for future recurring use but MUST NOT be auto-charged by the cron.

#### Scenario: Successful USD charge
- **WHEN** an international user completes the Payple Global checkout for $7.99
- **THEN** a `Payment` row is inserted with `amount=799` (cents), `currency="USD"`, `paymentRegion="international"`, `status="completed"`
- **AND** `Subscription.tier="pro"`, `nextBillingDate=<charge-time + 1 month>`

#### Scenario: Cron skips international subscriptions
- **WHEN** the renewal cron iterates and finds a subscription with `billingKeyType="international_card"`
- **THEN** it skips the row and queues an in-app reminder instead of charging

### Requirement: Refund / cancel API
The system SHALL expose a server-only `refundPayment(paymentId, amount?)` helper that calls `POST {base}/php/SimplePayCardAct.php?ACT_=PAYC` with `PCD_REFUND_KEY`, `PCD_PAY_OID`, `PCD_PAY_DATE`, `PCD_REFUND_TOTAL`. Partial refunds are out of scope for this release — `amount` MUST equal the original `Payment.amount` or be omitted.

#### Scenario: Full refund succeeds
- **WHEN** an admin (via Prisma Studio or future admin UI) calls `refundPayment("payment_id")` for a completed payment
- **THEN** the original `Payment.status` becomes `"refunded"` and `refundedAt` is set
- **AND** Payple returns `PCD_PAY_RST=success` with response code `PAYC0000`

#### Scenario: Already-refunded payment is rejected
- **WHEN** `refundPayment` is called for a payment whose status is already `"refunded"`
- **THEN** the helper throws `AlreadyRefundedError` and makes no upstream call

### Requirement: Webhook intake with lookup-based verification
The system SHALL expose `POST /api/payple/webhook` that receives both PCD-style (`application/x-www-form-urlencoded`, domestic) and JSON (global) bodies. Because Payple does NOT publish a webhook signature scheme, the handler SHALL re-query Payple's lookup endpoint (`/php/payInfo.php` for domestic, `/gpay/result` for global) using `PCD_PAY_OID` / `service_oid` and SHALL only mutate state when the lookup confirms the same status, amount, and order id. The handler SHALL respond with `{ isOk: true }` even on duplicate events.

#### Scenario: Domestic success webhook is verified before commit
- **WHEN** Payple POSTs `PCD_PAY_RST=success` to `/api/payple/webhook`
- **THEN** the handler calls `payInfo.php` with the same `PCD_PAY_OID`
- **AND** only commits the `Payment` insert and tier change if the lookup also returns success with matching amount

#### Scenario: Lookup mismatch is treated as fraud
- **WHEN** the webhook says success but the lookup returns `error` or a different amount
- **THEN** the handler logs an alert, persists a `Payment` row with `status="suspicious"`, and does NOT change the subscription tier

#### Scenario: Duplicate webhook is idempotent
- **WHEN** Payple POSTs the same `PCD_PAY_OID` twice
- **THEN** only one `Payment` row exists for that order id (unique index)
- **AND** the second request returns `{ isOk: true }` with no further mutation

### Requirement: Receipt URL persistence
The system SHALL persist Payple's `PCD_PAY_CARDRECEIPT` (or global equivalent) on `Payment.receiptUrl` whenever the response includes it. The system SHALL expose this URL via tRPC `payment.getReceiptUrl({ paymentId })` to the owner only.

#### Scenario: Receipt URL exposed to owner
- **WHEN** a user requests `payment.getReceiptUrl` for their own payment
- **THEN** tRPC returns the stored URL string

#### Scenario: Receipt URL not exposed to other users
- **WHEN** user A requests `payment.getReceiptUrl` for user B's payment
- **THEN** tRPC throws `FORBIDDEN`

### Requirement: Currency and amount handling
The system SHALL store `Payment.amount` as an integer in the smallest unit of `Payment.currency` (KRW = whole won, USD = cents). The system SHALL compute display strings via a single helper (`formatMoney(amount, currency)`). VAT for KRW SHALL be quoted "별도" — `PRICE_PRO_MONTH_KRW=9000` is the pre-VAT amount; the actual charge SHALL include VAT calculated as `Math.round(base * 1.1)` and SHALL be stored on `Payment.amount` as the final charged amount.

#### Scenario: KRW charge stores VAT-included amount
- **WHEN** `PRICE_PRO_MONTH_KRW=9000` and a charge is made
- **THEN** Payple is called with `PCD_PAY_TOTAL=9900`
- **AND** `Payment.amount=9900` and `Payment.currency="KRW"`

#### Scenario: USD charge stores cents
- **WHEN** `PRICE_PRO_MONTH_USD=7.99` and a charge is made
- **THEN** `Payment.amount=799` and `Payment.currency="USD"`
