## ADDED Requirements

### Requirement: Pricing page
The system SHALL render `/pricing` showing two plans (Free, Pro) with monthly KRW and USD prices. The Pro card SHALL show "₩9,000 / 월 (VAT 별도)" for KRW and "$7.99 / month" for USD. A region toggle SHALL switch between domestic-card checkout and international-card checkout. Authenticated `pro` users SHALL see "현재 플랜" instead of the upgrade button. Authenticated `canceled_grace` users SHALL see a "재구독" button that calls `payment.uncancelSubscription` (clears `canceledAt`).

#### Scenario: Anonymous visitor sees CTAs that route to login
- **WHEN** a logged-out user clicks "Pro로 업그레이드"
- **THEN** the user is redirected to `/login?next=/pricing`

#### Scenario: Active pro user sees current-plan badge
- **WHEN** an `active` pro user visits `/pricing`
- **THEN** the Pro card shows "현재 플랜" and the upgrade button is replaced by a "관리" link to `/account/payments`

#### Scenario: Region toggle switches checkout flow
- **WHEN** the user clicks "International"
- **THEN** the upgrade button calls the global Payple flow with USD pricing on submission

### Requirement: Dashboard upgrade CTA
The `/projects` dashboard SHALL render a "Pro로 업그레이드" CTA in the header for any user whose subscription is `free` or `expired`. Clicking the CTA SHALL navigate to `/pricing`. The CTA SHALL be hidden for `active`, `pending_retry`, or `canceled_grace` states.

#### Scenario: Free user sees CTA
- **WHEN** a `free` user loads `/projects`
- **THEN** the header includes a visible "Pro로 업그레이드" button

#### Scenario: Active user does not see CTA
- **WHEN** an `active` user loads `/projects`
- **THEN** the header omits the upgrade CTA

### Requirement: Payple checkout-script loading
The system SHALL load Payple's `cpay.js` (domestic) or `pglobal.js` (global) only on the pricing page and only when the user clicks "결제하기", using `next/script` with `strategy="afterInteractive"`. The Next.js CSP `script-src` directive SHALL include `https://democpay.payple.kr https://cpay.payple.kr https://demo-api.payple.kr https://api.payple.kr`. The system SHALL NOT load Payple scripts on any other page.

#### Scenario: Script loads only on click
- **WHEN** a user lands on `/pricing` without clicking the button
- **THEN** the page HTML contains no `cpay.js` reference

#### Scenario: Script load failure shows fallback
- **WHEN** the Payple script fails to load (network error)
- **THEN** the button shows a toast "결제 시스템 연결에 실패했어요. 잠시 후 다시 시도해주세요."

### Requirement: Post-payment redirect and toast
After Payple's checkout overlay calls back successfully, the client SHALL invalidate the `subscription.getCurrent` tRPC query, redirect to `/account/payments?welcome=pro`, and show a sonner toast "Pro 구독이 시작됐어요". On failure callback, the client SHALL stay on `/pricing` and show a toast with the localized error message.

#### Scenario: Successful checkout redirects
- **WHEN** Payple callback returns `PCD_PAY_RST=success`
- **THEN** the URL becomes `/account/payments?welcome=pro` and a green toast appears

#### Scenario: User cancels in Payple overlay
- **WHEN** the user closes the Payple overlay without paying
- **THEN** the user remains on `/pricing` with no toast and no state mutation
