## ADDED Requirements

### Requirement: Pricing page
The system SHALL provide a public `/pricing` page presenting Free and Pro tiers with VAT-included KRW prices, a monthly/annual toggle, a feature comparison list, and a primary CTA that opens the NICE checkout window for authenticated users (or routes unauthenticated users to login first).

#### Scenario: Authenticated user starts checkout
- **WHEN** a logged-in Free user clicks "Pro 시작하기" with the annual toggle on `/pricing`
- **THEN** the system calls `paymentRouter.createCheckoutSession({ plan: 'yearly' })`, loads the NICE JS SDK via `next/script`, and invokes `AUTHNICE.requestPay(...)` with the server-issued `clientId, orderId, amount=199000, goodsName='Splash Pro Yearly', returnUrl, currency='KRW'`

#### Scenario: Unauthenticated user redirected to login
- **WHEN** a guest clicks the Pro CTA
- **THEN** the system redirects to `/login?next=/pricing` and returns the user to `/pricing` after sign-in

#### Scenario: Payments disabled hides CTA
- **WHEN** `NEXT_PUBLIC_PAYMENTS_ENABLED !== 'true'`
- **THEN** the Pro CTA MUST be replaced by a "곧 공개" placeholder and `createCheckoutSession` MUST return HTTP 503 if called

### Requirement: Account payments page
The system SHALL provide an authenticated `/account/payments` page showing the current subscription state (tier, periodEnd, billingState, nextBillingDate, masked card last4), a chronological payment history with NICE receipt links, and controls for cancel/uncancel/refund according to eligibility.

#### Scenario: Active subscription panel
- **WHEN** an active Pro user opens `/account/payments`
- **THEN** the page MUST show "Pro · 다음 결제 {nextBillingDate} · {cardBrand} •••• {last4}" and a "구독 취소" button

#### Scenario: Canceled grace panel
- **WHEN** the user has cancelled and is in `canceled_grace`
- **THEN** the page MUST show "{cancelEffectiveAt}까지 Pro 사용 가능" and a "취소 되돌리기" button

#### Scenario: Refund button visibility
- **WHEN** the most recent paid Payment is within 7 days AND the user's current-period generation usage is 0
- **THEN** a "환불 요청" button MUST be visible on that payment row; otherwise it MUST be hidden with tooltip explaining ineligibility

### Requirement: Dashboard upgrade CTA
The system SHALL render an upgrade CTA on the projects dashboard for Free users that links to `/pricing`, with copy adapted to the user's recent rate-limit state (e.g., "오늘 한도 도달 — Pro로 업그레이드").

#### Scenario: Rate-limit-aware CTA
- **WHEN** a Free user has hit the daily generation limit at least once today
- **THEN** the CTA copy MUST read "오늘 한도 도달 — Pro로 업그레이드" instead of the default copy

### Requirement: Cash receipt selection in checkout
The system SHALL surface NICE's `directReceiptType` selection (unPublished / individual / company) inside the NICE checkout window for vbank or bank methods, allowing the user to choose receipt issuance at payment time.

#### Scenario: Vbank checkout exposes receipt type
- **WHEN** the user picks vbank in the NICE checkout window
- **THEN** the request to NICE MUST omit `directReceiptType` so NICE displays its built-in receipt selector to the user

### Requirement: NICE JS SDK loading and CSP
The system SHALL load `https://pay.nicepay.co.kr/v1/js/` only on `/pricing` and `/account/payments` via `next/script` with `strategy='afterInteractive'`, and the production CSP SHALL allowlist `pay.nicepay.co.kr`, `start-pay.nicepay.co.kr`, and `api.nicepay.co.kr` only.

#### Scenario: SDK not present on unrelated pages
- **WHEN** the user opens any non-billing page
- **THEN** the NICE SDK script MUST NOT be present in the rendered HTML

#### Scenario: CSP blocks unknown PG domains
- **WHEN** an attacker injects a script tag pointing to a non-NICE PG host
- **THEN** the browser CSP MUST block the load and the violation MUST be reported via the existing CSP report channel
