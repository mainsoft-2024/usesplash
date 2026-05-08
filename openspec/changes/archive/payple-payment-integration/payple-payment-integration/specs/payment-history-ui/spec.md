## ADDED Requirements

### Requirement: Account payments page
The system SHALL render `/account/payments` for authenticated users showing a chronological list of their `Payment` rows with columns: 결제일, 금액, 결제수단, 상태, 영수증. Each row SHALL display the receipt URL as a "보기" link that opens in a new tab. The page SHALL paginate at 20 rows per page server-side via tRPC `payment.listPayments`.

#### Scenario: User sees their payments
- **WHEN** a pro user loads `/account/payments`
- **THEN** the page shows their payments newest-first with all five columns

#### Scenario: Empty-state for free user
- **WHEN** a `free` user with no payments loads the page
- **THEN** the page shows "아직 결제 내역이 없어요" and a CTA to `/pricing`

#### Scenario: Receipt link opens Payple URL
- **WHEN** the user clicks "보기" on a payment row
- **THEN** the browser opens `Payment.receiptUrl` in a new tab with `rel="noopener"`

### Requirement: Subscription status panel
The `/account/payments` page SHALL render a status panel showing current state (active / pending_retry / canceled_grace / free), `nextBillingDate` (if applicable), and a primary action button:

| State            | Action                                                   |
|------------------|----------------------------------------------------------|
| `active`         | "구독 해지" → opens cancel-confirmation modal             |
| `pending_retry`  | "지금 결제하기" → calls `payment.chargeNow`               |
| `canceled_grace` | "재구독" → calls `payment.uncancelSubscription`           |
| `free`/`expired` | "Pro로 업그레이드" → links to `/pricing`                  |

#### Scenario: Active state shows cancel button
- **WHEN** an `active` user loads the page
- **THEN** the panel shows "다음 결제일: 2026-05-27" and a "구독 해지" button

#### Scenario: Pending-retry state shows charge-now button
- **WHEN** a `pending_retry` user loads the page
- **THEN** the panel shows the failure reason and a "지금 결제하기" button

### Requirement: Cancel confirmation modal
The "구독 해지" button SHALL open a modal requiring the user to (a) read a notice that Pro access continues until `nextBillingDate`, (b) optionally pick a cancel reason from a dropdown, (c) type "해지" to confirm. Clicking "해지하기" SHALL call `payment.cancelSubscription`. The button SHALL be disabled until "해지" is typed exactly.

#### Scenario: Confirmation typing gate
- **WHEN** the user has typed "해" only
- **THEN** the "해지하기" button is disabled

#### Scenario: Successful cancel updates UI optimistically
- **WHEN** the user submits the cancel form
- **THEN** the modal closes, the panel re-renders to `canceled_grace`, and a toast "다음 결제일까지 Pro를 유지합니다" appears
