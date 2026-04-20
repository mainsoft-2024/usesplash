# Design System: Admin Insights Widgets

This document specifies the structural wireframes and states for each widget required in Phase 4.2 of the `admin-dashboard-insights-overhaul`.

---

## 1. Threshold Banners

**Props:**
```typescript
interface ThresholdBannerProps {
  id: string // for localStorage dismiss state
  type: "warning" | "danger" | "info"
  title: string
  message: string
}
```
**Wireframe:**
```
+-------------------------------------------------------------+
| [Icon] **Title**: Message                                [x]|
+-------------------------------------------------------------+
```
- **States:**
  - *Hidden*: If dismissed via `[x]`, check `localStorage.getItem('dismissed_banners')`.
- **Responsive**: Full width of container. Text wraps on mobile.

---

## 2. Filter Bar & Tab Nav

**Props:**
```typescript
interface FilterBarProps {
  activeTab: "overview" | "cost" | "revenue" | "users" | "assets"
  period: 7 | 30 | 90 | "all"
  searchQuery?: string
  tierFilter?: Tier[]
}
```
**Wireframe:**
```
[Tabs: 개요 | 비용 | 수익 | 사용자 | 자료 ]
--------------------------------------------------------------
[ Search users... ] [ Tiers ▾ ] [ Period: 30일 ▾ ] [Export CSV]
```
- **States:**
  - *Active Tab*: `border-[var(--accent-green)] text-white`.
  - *Dropdowns*: 1px border `#2a2a2a` popover, solid `#1a1a1a` background.
- **Responsive**: On mobile, tabs scroll horizontally (`overflow-x-auto`), filters stack or wrap.

---

## 3. CSV Export Button

**Props:**
```typescript
interface CsvExportButtonProps {
  dataUrl: string // or onClick handler that triggers download
  isExporting: boolean
}
```
- **Appearance**: Outlined button, `border-[#2a2a2a] text-[#a1a1a1] hover:text-white hover:border-[#a1a1a1]`.
- **Loading State**: Spinner icon replaces download icon. "내보내는 중...".

---

## 4. KPI Card

**Props:**
```typescript
interface KpiCardProps {
  label: string
  value: string | number
  trend?: { direction: "up" | "down", percentage: number }
  sparkline?: number[]
}
```
- **Structure**: Existing pattern from `admin/page.tsx` L146-185.
- **Loading State**: Value is replaced by an animate-pulse block (`h-8 w-24 bg-[#2a2a2a] rounded`). Sparkline area is empty.
- **Error State**: Displays "Error loading data" in red-500.

---

## 5. Stacked Area Chart (API Costs)

**Props:**
```typescript
interface StackedAreaChartProps {
  data: Array<{
    date: string
    geminiCost: number
    llmCost: number
    blobCost: number
  }>
}
```
- **Wireframe**: Recharts `<AreaChart>` wrapped in `<ResponsiveContainer>`.
- **Palette**: Gemini (emerald), LLM (violet), Blob (blue).
- **Empty State**: Chart area shows a centered `#a1a1a1` text: "No cost data available".
- **Responsive**: Chart height 300px on desktop, 200px on mobile.

---

## 6. MRR KPI Row / Card

**Props:**
```typescript
interface MrrKpiProps {
  currentMrr: number
  arr: number
  momGrowth: number
  activeProUsers: number
}
```
**Wireframe:**
```
+------------------+------------------+------------------+
| MRR              | ARR              | Active Pro       |
| $1,250           | $15,000          | 125              |
| ^ +5.2% MoM      | -                | ^ +12            |
+------------------+------------------+------------------+
```
- **Layout**: CSS Grid, 3 columns on desktop, 1 column on mobile.
- **Styling**: Values use tabular numerals and green text for positive growth.

---

## 7. Margin & Burn Card

**Props:**
```typescript
interface MarginCardProps {
  revenue: number
  cost: number
  grossMarginPct: number
  monthlyBurn: number
}
```
- **Visuals**: Large gauge or simple progress bar showing margin %.
- **Color**: Margin < 70% turns the bar from green to warning/yellow. Burn rate text in red if > revenue.

---

## 8. User Ranking Table

**Props:**
```typescript
interface UserRankingTableProps {
  users: Array<{ id: string, name: string, cost: number, revenue: number, margin: number }>
  sortBy: "cost" | "revenue" | "margin"
}
```
- **Density**: `h-10` rows.
- **Columns**: User, Total API Cost, LTV (Revenue), Margin %.
- **Loading State**: 5 rows of skeleton text (`bg-[#2a2a2a]`).
- **Empty State**: "No active users found."

---

## 9. Funnel Chart

**Props:**
```typescript
interface FunnelChartProps {
  stages: {
    signup: number
    firstProject: number
    firstGeneration: number
    proUpgrade: number
  }
}
```
**Wireframe:**
```
Signup (1,000) ------------------------------------- 100%
  ↳ Project (800) ----------------------------- 80%
      ↳ Generation (600) ------------------- 60%
          ↳ Pro (50) --- 5%
```
- **Implementation**: Simple HTML/CSS bar charts or Recharts `<FunnelChart>`.
- **Visuals**: Decreasing bar widths.

---

## 10. Cohort Retention Heatmap

**Props:**
```typescript
interface CohortRetentionProps {
  cohorts: Array<{
    week: string // e.g. "2026-04-14"
    size: number
    retention: number[] // array of 8 percentages for W0..W7
  }>
}
```
- **Implementation**: Native SVG or CSS Grid of `div`s.
- **Palette**: 5-bucket quantile using `bg-blue-500` with varying opacities (`/20`, `/40`, `/70`, `100`).
- **Empty State**: Gray grid with "0%" in all cells.
- **Responsive**: Overflow-x-auto on mobile to preserve minimum cell size (e.g., 40x40px).

---

## 11. Hour-DOW Usage Heatmap

**Props:**
```typescript
interface HourDowHeatmapProps {
  matrix: number[][] // 7 days x 24 hours
}
```
- **Implementation**: Native SVG or CSS Grid. 7 rows (Mon-Sun), 24 columns (00-23).
- **Labels**: Y-axis "월" to "일", X-axis "0" to "23".
- **Interaction**: Tooltip on hover showing exact generation count.

---

## 12. Gemini Rate-limit / Error Panel

**Props:**
```typescript
interface GeminiErrorPanelProps {
  totalRequests: number
  errorRate: number
  retryRate: number
  recentErrors: Array<{ time: string, code: string }>
}
```
- **Visuals**: Red/Warning themed card. If error rate > 5%, header flashes or is bolded.
- **Layout**: Top half shows KPI numbers, bottom half shows a mini-feed of the last 5 errors.

---

## 13. Activity Feed (Infinite Scroll)

**Props:**
```typescript
interface ActivityFeedProps {
  events: Array<{ id: string, type: "generation" | "upgrade", user: string, time: string }>
  onLoadMore: () => void
  hasMore: boolean
}
```
**Wireframe:**
```
[Refresh Button]
|  10:42 AM - User A generated 4 images
|  10:15 AM - User B upgraded to Pro
|  09:05 AM - User C generated 1 image
[ Load More... ]
```
- **Implementation**: Vertical line (`border-l border-[#2a2a2a]`) connecting dots.
- **Loading State**: Skeleton dots and lines.

---

## 14. Keyword Bar Chart

**Props:**
```typescript
interface KeywordChartProps {
  data: Array<{ keyword: string, count: number }>
}
```
- **Implementation**: Recharts `<BarChart>` (horizontal layout: `layout="vertical"`).
- **Color**: Solid `var(--accent-green)`.
- **Axis**: Hide Y-axis line, show labels.

---

## 15. Sample Gallery (Mosaic)

**Props:**
```typescript
interface SampleGalleryProps {
  images: Array<{ url: string, prompt: string, user: string }>
}
```
- **Layout**: CSS Grid, `grid-cols-2 md:grid-cols-4 lg:grid-cols-6`, `gap-4`.
- **Card**: Image with object-fit cover, `rounded-lg`, hover effect reveals prompt and user email in a semi-transparent black overlay.
- **Empty State**: "No recent generations."
- **Loading State**: 24 gray boxes `bg-[#2a2a2a] animate-pulse rounded-lg aspect-square`.
