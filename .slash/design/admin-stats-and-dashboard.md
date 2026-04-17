# Design System Update: Premium Admin & User Dashboard

This document outlines the detailed design implementation for the upgraded, professional SaaS Admin Dashboard and the redesigned User Dashboard. It follows the "studio" aesthetic defined in `system.md` (borders-only depth, dark background, signature `--accent-green`, high contrast text) and leverages industry best practices for data-heavy SaaS platforms.

---

## Feature 1: Admin Dashboard (Complete Overhaul)

**Goal**: Transform the current basic admin panel into a premium, data-rich experience similar to Vercel, Stripe, or Linear.

### 1. Layout Structure
The dashboard follows a Dark Sidebar + Light Content (adapted to full dark mode) pattern, employing a 12-column grid and the 40-30-20-10 space allocation rule.
- **Top Row (100% width)**: Page Title & Navigation/Filters.
- **Hero Row (Section A)**: 4 KPI Cards with sparklines.
- **Centerpiece (Section B)**: Full-width Area Chart for 30-day generation trends.
- **Bottom Split**: User Management Table (Section C, 8 columns) + Quick Insights Sidebar (Section D, 4 columns).

### 2. Section A: KPI Hero Row
**Component**: `AdminKPICard`
**Props**: 
```ts
interface AdminKPICardProps {
  label: string;
  value: string | number;
  trendValue: string; // e.g., "+12.5%" or "-3.2%"
  trendDirection: "up" | "down" | "neutral";
  sparklineData: number[];
}
```
**Tailwind Classes**:
- **Container**: `grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4 mb-8`
- **Card**: `group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5 transition-all hover:border-[var(--accent-green)] hover:bg-[#1f1f1f]`
- **Header**: `flex items-center justify-between text-sm font-medium tracking-wide text-[#a1a1a1]`
- **Value**: `mt-2 text-3xl font-semibold tracking-tight text-white`
- **Trend Indicator (Up)**: `inline-flex items-center gap-1 text-xs font-medium text-[#10b981]`
- **Trend Indicator (Down)**: `inline-flex items-center gap-1 text-xs font-medium text-[#ef4444]`
- **Sparkline Container**: `mt-4 h-[40px] w-full`
**Animations**: Subtle border glow and background lightness shift on hover. Sparklines draw in from left to right on mount.

### 3. Section B: Generation Activity Chart
**Component**: `AdminActivityChart`
**Props**:
```ts
interface AdminActivityChartProps {
  data: Array<{ date: string; count: number }>;
  period: 7 | 30 | 90;
  onPeriodChange: (days: 7 | 30 | 90) => void;
}
```
**Tailwind Classes**:
- **Card Wrapper**: `mb-8 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6`
- **Header**: `mb-6 flex items-center justify-between`
- **Title**: `text-lg font-semibold text-white`
- **Toggle Group**: `flex items-center rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-1`
- **Toggle Button (Active)**: `rounded-md bg-[#2a2a2a] px-3 py-1 text-sm font-medium text-white shadow-sm transition-all`
- **Toggle Button (Inactive)**: `rounded-md px-3 py-1 text-sm font-medium text-[#6b6b6b] hover:text-[#a1a1a1] transition-all`
**Interactions**: Hover crosshair over the area chart reveals a custom tooltip with exact date and count. Use gradient fill under the line (green to transparent).

### 4. Section C: User Table (Enhanced)
**Component**: `AdminUserTable`
**Props**: Existing users array, plus new inline trend data.
**Tailwind Classes**:
- **Container**: `col-span-1 xl:col-span-8 overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]`
- **Table**: `min-w-full text-sm text-left`
- **Header Row**: `border-b border-[#2a2a2a] bg-[#0f0f0f] text-xs uppercase tracking-wider text-[#a1a1a1]`
- **Row**: `group border-b border-[#2a2a2a] transition-colors hover:bg-[#1f1f1f]`
- **Cell**: `px-4 py-3 whitespace-nowrap`
- **Avatar/Initial**: `flex h-8 w-8 items-center justify-center rounded-full bg-[#2a2a2a] text-xs font-semibold text-white`
- **Status Dot (Active)**: `h-2 w-2 rounded-full bg-[#10b981]`
- **Status Dot (Inactive)**: `h-2 w-2 rounded-full bg-[#6b6b6b]`
- **Inline Sparkline**: `h-[30px] w-[80px]`
**Interactions**: Sticky header. Hovering over a row highlights it slightly. Dropdown actions (tier change, view details) on the far right.

### 5. Section D: Quick Insights Sidebar
**Component**: `AdminQuickInsights`
**Tailwind Classes**:
- **Container**: `col-span-1 xl:col-span-4 flex flex-col gap-6`
- **Panel Card**: `rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5`
- **Panel Title**: `mb-4 text-sm font-semibold uppercase tracking-wider text-[#a1a1a1]`
- **Activity Item**: `flex items-start gap-3 border-b border-[#2a2a2a] last:border-0 py-3 last:pb-0`
- **Time/Date**: `text-xs text-[#6b6b6b]`

### 6. Backend Requirements
- **`admin.getPlatformStats`**: Enhance to include 7-day trend data (previous 7 days vs last 7 days) and sparkline array.
- **`admin.getDailyGenerations`**: Platform-wide daily generation counts for the area chart (configurable by days).
- **`admin.getRecentActivity`**: Last 10-20 generation events with user info for the sidebar feed.

---

## Feature 2: User Dashboard (Premium Redesign)

**Goal**: Upgrade the user's `/projects` dashboard to a highly polished, unified SaaS usage widget.

### 1. Layout Structure
A single, premium card encapsulating all usage data, divided into three internal sections.
- **Header**: Personalized greeting.
- **Body Grid**: 3-column split for Plan, Today's Stats, and 7-day Sparkline Trend.
- **Bottom**: Full area chart for detailed usage over time.

### 2. Components & Structure
**Component**: `UserPremiumDashboard`
**Tailwind Classes**:
- **Outer Card**: `mb-8 overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-sm`
- **Header Area**: `border-b border-[#2a2a2a] bg-[#141414] px-6 py-4 flex items-center justify-between`
- **Greeting**: `text-lg font-semibold text-white`
- **Grid Container**: `grid grid-cols-1 gap-6 md:grid-cols-3 p-6`
- **Stat Column**: `flex flex-col gap-2`
- **Circular Progress (Ring)**: Replace the standard bar with an SVG circular progress ring for a more high-end feel.
- **Area Chart Container**: `border-t border-[#2a2a2a] p-6 h-[280px]`

### 3. Interactions & Animations
- **Progress Ring**: Stroke-dashoffset animates from 0 to target percentage. Color shifts from `--accent-green` to `#ef4444` if usage > 90%.
- **Area Chart**: Gradient fill underneath the line, seamless hover tooltips matching the dark theme (`#1a1a1a` bg, `#2a2a2a` border).

### 4. Backend Requirements
- **`usage.getWeeklySparkline`**: A lightweight endpoint (or derived from `getDailyChart`) returning a simple array of the last 7 days for the compact sparkline view.

---

## Global Design Constraints

1. **Color Tokens**:
   - Background (Base): `#0e0e0e`
   - Surface (Cards): `#1a1a1a`
   - Surface Hover/Elevated: `#1f1f1f`
   - Borders: `#2a2a2a`
   - Primary Text: `#ffffff`
   - Secondary Text: `#a1a1a1`
   - Muted/Tertiary Text: `#6b6b6b`
   - Accent (Brand): `var(--accent-green)` (`#4CAF50` or similar neon/studio green)
   - Success: `#10b981`
   - Error: `#ef4444`

2. **Typography**:
   - Strictly Korean for all labels (e.g., "전체 사용자", "일별 생성 추이").
   - Inter (or system sans-serif) with tight tracking for headlines, comfortable line-height (1.6) for body.

3. **Depth & Hierarchy**:
   - Strictly BORDERS-ONLY for depth. No drop shadows.
   - Use `blur-2xl` glowing orbs with extremely low opacity (`5-10%`) for premium emphasis on key metrics.

4. **Mobile Responsive**:
   - Stacks gracefully.
   - Area charts shrink in height or hide less critical axes.
   - Tables scroll horizontally with a subtle gradient mask indicating overflow.
