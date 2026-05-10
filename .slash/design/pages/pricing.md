# Design System: Splash Pricing Page

## Generated Recommendations
- **Palette:** Inherits dark mode core (`var(--bg-primary)`, `var(--bg-secondary)`) with `var(--accent-green)` for primary actions. `var(--text-primary)` for headings, `var(--text-secondary)` for body.
- **Typography:** Pretendard/sans-serif. Bold for prices, medium for plan names.
- **Tone:** Informal Korean ("친구한테 말하듯"). Clear, transparent pricing.

## Craft Decisions
- **Direction:** Clean, straightforward SaaS pricing. No dark patterns.
- **Signature:** Glowing green accent behind the Pro card to emphasize it without being visually overwhelming.
- **Depth:** Subtle borders (`var(--border-primary)`) on Free plan, layered shadows and glowing inset borders on Pro plan.
- **Spacing:** Base unit 4px. 24px padding in cards, 32px between sections.
- **Color temperature:** Cool dark background with vibrant electric green (`var(--accent-green)`).

## Component Patterns

### 1. Region Toggle (`region-toggle.tsx`)
A simple segmented control to switch between Domestic (KRW) and International (USD) pricing.
- **Container:** `bg-[var(--bg-secondary)] rounded-full p-1 border border-[var(--border-primary)] inline-flex`
- **Options:** "국내 결제", "해외 결제 (USD)"
- **Active State:** `bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm rounded-full`
- **Inactive State:** `text-[var(--text-secondary)] hover:text-[var(--text-primary)]`

### 2. Pricing Card (`pricing-card.tsx`)
Two variants: Free and Pro.

#### Free Plan
- **Border:** `border-[var(--border-primary)]`
- **Background:** `bg-[var(--bg-secondary)]`
- **Price:** `₩0`
- **Features:** 3 projects, basic exports.
- **Action:** If anonymous -> "무료로 시작하기" (redirect to `/login`). If logged in -> "현재 요금제" (disabled).

#### Pro Plan
- **Border:** `border-[var(--accent-green)]`
- **Background:** `bg-[var(--bg-secondary)]` with a subtle `var(--accent-green)/10` top gradient.
- **Price:** 
  - Domestic: `₩9,000` (subtext: `+ VAT / 월`)
  - International: `$7.99` (subtext: `/ month (One-time charge)`)
- **Features:** Unlimited projects, SVG export, high-res downloads, commercial use.
- **Action:** "Pro로 업그레이드" (triggers `payple-checkout-button`).

### 3. Payple Checkout Button (`payple-checkout-button.tsx`)
- **Style:** Uses primary button styling (`bg-[var(--accent-green)] text-black font-medium hover:bg-[var(--accent-green-hover)]`).
- **Loading State:** Spinner with "결제 준비 중...".
- **Error State:** Toaster notification on failure.

## Page Layout & States (`/pricing`)

**Header:** Reuses `SharedHeader`.
**Footer:** Reuses `SharedFooter`.

**Wireframe Layout:**
```
[ Shared Header ]

[Title: 당신의 브랜드를 완성하세요]
[Subtitle: 복잡한 요금제 없이, 딱 필요한 것만.]

    [ Region Toggle: (국내 결제) | 해외 결제 ]

    +-------------------+  +---------------------------------+
    | Free              |  | Pro                             |
    | ₩0                |  | ₩9,000 + VAT / 월               |
    |                   |  |                                 |
    | - 3개 프로젝트    |  | - 무제한 프로젝트               |
    | - 기본 PNG 다운   |  | - SVG, 고해상도 다운로드        |
    | - 워터마크        |  | - 상업적 이용 가능              |
    |                   |  |                                 |
    | [현재 요금제]     |  | [ Pro로 업그레이드 ]            |
    +-------------------+  +---------------------------------+

[ Shared Footer ]
```

### States
- **NEXT_PUBLIC_PAYMENTS_ENABLED = false:**
  - Pro card action button is disabled with text "곧 오픈합니다!".
- **Anonymous:** 
  - Free card -> "무료로 시작하기" (href `/login`).
  - Pro card -> "로그인 후 업그레이드" (href `/login`).
- **Logged In (Free):** 
  - Free card -> "현재 요금제" (disabled).
  - Pro card -> "Pro로 업그레이드".
- **Logged In (Active / Pending Retry / Canceled Grace):** 
  - Free card -> (hidden or disabled).
  - Pro card -> "현재 사용 중" (disabled) + "결제 관리" link to `/account/payments`.
- **Logged In (Expired):** 
  - Same as Logged In (Free).

### Error & Toasts
- `결제창을 띄우는 중 오류가 발생했어요.`
- `결제가 취소되었어요.`
- `결제가 완료되었습니다! 이제 Pro 기능을 사용할 수 있어요.`
