# Design System: Upgrade CTA Component

## Generated Recommendations
- **Location:** Anchored at the top of the `/projects` dashboard header or integrated into the top bar.
- **Palette:** Uses `var(--accent-green)` with high contrast text for attention without aggressive animation.
- **Tone:** Inviting, contextual, value-driven. "업그레이드하고 워터마크 없는 로고를 만나보세요."

## Craft Decisions
- **Direction:** Subtle banner style that blends with the UI rather than breaking it. Not an aggressive pop-up or modal.
- **Spacing:** `py-2.5 px-4` inside a `rounded-xl` or full-width banner.
- **Typography:** `text-sm font-medium`.

## Component Details (`upgrade-cta.tsx`)

### Position
Sits directly below the `SharedHeader` on the `/projects` dashboard (or built into the project list header row). A horizontal strip: `bg-[var(--accent-green)/10] text-[var(--accent-green)] border border-[var(--accent-green)/20] rounded-xl`.

### State-Driven Display

#### `free` (무료)
- **Visible:** Yes
- **Copy:** "🔥 Pro로 업그레이드하고 무제한 고화질 로고를 다운로드하세요."
- **Action Button:** "요금제 보기" -> Links to `/pricing`. `bg-[var(--accent-green)] text-black px-3 py-1.5 rounded-lg text-xs font-semibold`.
- **Dismissible:** No. Remains as a permanent, non-obtrusive up-sell block until upgraded.

#### `active` (사용 중) / `pending_retry` (재시도 대기)
- **Visible:** No. Component returns `null`.

#### `canceled_grace` (해지 대기)
- **Visible:** Yes
- **Style:** Warning variant. `bg-yellow-500/10 text-yellow-500 border border-yellow-500/20`.
- **Copy:** "⚠️ 다음 결제일에 구독이 만료됩니다. Pro 기능을 유지하려면 해지를 취소하세요."
- **Action Button:** "결제 관리" -> Links to `/account/payments`.

#### `expired` (만료됨)
- **Visible:** Yes
- **Style:** Alert/Info variant. `bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)]`.
- **Copy:** "Pro 구독이 만료되었습니다. 다시 업그레이드하시겠어요?"
- **Action Button:** "업그레이드" -> Links to `/pricing`.

### Responsive Notes
- **Mobile (`md` and below):**
  - Text truncates or wraps tightly.
  - Action button moves below the text text if needed, or stays inline if space permits.
  - `flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 p-4`.

### Error/Loading State
- `isLoading`: Returns `null` or a slim `h-10 w-full animate-pulse bg-[var(--bg-tertiary)] rounded-xl` to prevent layout shift.
- `isError`: Returns `null` to fail silently without breaking the dashboard experience.
