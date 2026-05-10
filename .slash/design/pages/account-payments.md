# Design System: Account Payments

## Generated Recommendations
- **Layout:** Standard settings page layout (sidebar nav + main content area).
- **Tone:** Professional, informative. Clear status communication.
- **Components:** Uses Shadcn-like table, badges, modal, and panel components.

## Craft Decisions
- **Direction:** Administrative dashboard feel. No unnecessary flair, focus on clarity and utility.
- **Typography:** `text-sm` for table data, `font-medium` for headers, `text-xs` for status badges.
- **Color Temperature:** Neutral grays for history, red (`var(--accent-red)`) only for destructive actions (cancel).

## Page Layout & States (`/account/payments`)

**Header:** Reuses `SharedHeader`
**Sidebar:**
- Account Settings
- **Billing & Payments** (Active)

**Wireframe Layout:**
```
[ Shared Header ]

[ Account Settings Sidebar ] | [ Billing & Payments ]
                             | 
                             | [ SubscriptionStatusPanel ]
                             | 
                             | [ Payment History Table ]
```

### 1. Subscription Status Panel (`subscription-status-panel.tsx`)
A prominent card showing current tier, next billing date, and primary action.
- **Container:** `bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-6`

#### State Machine & Actions (from `design.md`)

| State | UI Display (Status Badge) | Description Copy | Primary Action Button |
| --- | --- | --- | --- |
| `free` | 회색 배지 "무료" | "현재 무료 요금제를 사용 중입니다." | "Pro로 업그레이드" (href `/pricing`) |
| `active` | 녹색 배지 "Pro" | "다음 결제일: YYYY년 MM월 DD일" | "구독 해지" (Opens `CancelSubscriptionModal`, text-red-500) |
| `pending_retry` | 노란색 배지 "결제 재시도 대기" | "결제에 실패했습니다. 결제수단을 확인해주세요. 다음 시도일: YYYY년 MM월 DD일" | "결제수단 변경" / "재결제 시도" |
| `canceled_grace` | 노란색 배지 "해지 대기" | "YYYY년 MM월 DD일까지 이용 가능합니다. 그 이후 무료로 전환됩니다." | "구독 재개" (Uncancel, triggers API) |
| `expired` | 빨간색 배지 "만료됨" | "구독이 만료되었습니다. Pro 기능을 다시 이용하려면 업그레이드하세요." | "Pro로 업그레이드" (href `/pricing`) |

- **Loading Skeletons:** A pulsating `bg-[var(--bg-tertiary)]` block in place of the text and badge.

### 2. Cancel Subscription Modal (`cancel-subscription-modal.tsx`)
- **Trigger:** "구독 해지" button in the `active` state.
- **Container:** Fixed centered modal, dark overlay `bg-black/60`, white/dark card `bg-[var(--bg-secondary)]`.
- **Content:** 
  - Title: "정말 해지하시겠어요?"
  - Body: "지금 해지하셔도 결제된 주기의 마지막 날(YYYY년 MM월 DD일)까지는 Pro 기능을 계속 사용할 수 있습니다."
  - **Reason Dropdown (선택):** "해지 사유를 알려주세요" (가격 부담, 사용 빈도 낮음, 기능 부족, 기타).
  - **Typing Gate:** `해지`를 정확히 입력해야 "해지하기" 버튼 활성화.
    - Input: `placeholder="해지"`
- **Actions:** 
  - "취소" (Closes modal)
  - "해지하기" (Destructive, `bg-[var(--accent-red)] text-white disabled:opacity-50`)

### 3. Payment History Table (`payment-history.tsx`)
Paginated list of payments (fetch via tRPC `listPayments`).
- **Columns:**
  - **결제일:** `YYYY. MM. DD`
  - **금액:** `₩9,900` or `$7.99`
  - **상태:** "완료" (green), "실패" (red), "환불됨" (gray).
  - **영수증:** "영수증 보기" (Link to external Payple URL via `getReceiptUrl` target="_blank").
- **Empty State:** 
  - "결제 내역이 없습니다." text centered in a `border-dashed border-[var(--border-primary)]` block.
- **Pagination:** "이전" / "다음" buttons (disabled when cursor is null).
- **Loading State:** Table skeleton rows (3 rows default).

### Error & Toasts
- `해지 처리에 실패했습니다. 다시 시도해주세요.`
- `구독이 재개되었습니다. Pro 기능을 계속 이용할 수 있습니다.`
