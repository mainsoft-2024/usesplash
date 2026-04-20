# Design System: Admin Insights (Overhaul)

## Craft Decisions
- **Direction**: Dense, analytical, terminal-inspired but polished. High data density for operators.
- **Signature**: Linear-inspired dark mode. Monochromatic surfaces (`#1a1a1a` to `#2a2a2a`) with stark white primary text and precise `#a1a1a1` secondary text.
- **Depth**: Borders-only. Zero drop shadows. UI elements are separated by 1px `#2a2a2a` borders. Interactive hover states change border color or surface lightness slightly.
- **Spacing**: 4px base unit. Tight data rows for tables (h-10), comfortable card padding (p-5 for KPI cards).
- **Typography**: System sans-serif. Tabular numerals (`font-tabular-nums`) are mandatory for all data points, tables, and KPIs to ensure alignment. Tight tracking for KPI values.
- **Color temperature**: Cool darks. Accents rely on semantic meaning (emerald green for money/growth/success, red for burn/errors).

## Color Tokens (Dark Theme)

### Background & Surface
- **Background (App)**: `#000000` or existing root bg
- **Surface (Card/Panel)**: `#1a1a1a` (default), `#1f1f1f` (hover/active state)
- **Border**: `#2a2a2a` (default), `var(--accent-green)` (interactive focus/hover)

### Text
- **Primary**: `#ffffff` (KPI values, table data, active tabs)
- **Secondary**: `#a1a1a1` (labels, inactive tabs, table headers, axes)
- **Muted/Disabled**: `#6b6b6b` (empty states, inactive elements)

### Semantic Accents
- **Success / Positive Trend / Revenue**: `var(--accent-green)` (approx `#10b981`)
- **Danger / Negative Trend / Burn**: `#ef4444` (red-500)
- **Warning**: `#f59e0b` (amber-500)
- **Info**: `#3b82f6` (blue-500)

## Typography Scale
- **KPI Value**: `text-3xl font-semibold tracking-tight font-tabular-nums`
- **Card Header**: `text-xs uppercase tracking-wider text-[#a1a1a1]`
- **Body / Table Data**: `text-sm font-tabular-nums text-white`
- **Small / Meta**: `text-xs text-[#a1a1a1]`

## Spacing Scale
- `p-5` (20px): KPI card internal padding
- `p-4` (16px): Widget container padding
- `gap-4` (16px): Grid spacing between cards
- `gap-6` (24px): Spacing between major page sections

## Component Patterns

### Tab Navigation (`?tab=...`)
- **Layout**: Flex row, `gap-6`, `border-b border-[#2a2a2a]`, `mb-6`.
- **Inactive**: `text-[#a1a1a1] pb-3 border-b-2 border-transparent hover:text-white transition-colors`
- **Active**: `text-white pb-3 border-b-2 border-[var(--accent-green)] font-medium`

### Banners (Alerts / Thresholds)
- **Layout**: Full-width or container-width, `p-3`, `rounded-lg`, flex row with icon and dismiss button (`X`).
- **Danger**: `bg-[#7f1d1d]/20 border border-[#ef4444]/50 text-[#f87171]`
- **Warning**: `bg-[#78350f]/20 border border-[#f59e0b]/50 text-[#fbbf24]`
- **Info**: `bg-[#1e3a8a]/20 border border-[#3b82f6]/50 text-[#60a5fa]`

### Chart Palettes
- **3-Layer Stacked Area (API Costs)**:
  - Gemini Image: `#10b981` (emerald-500)
  - OpenRouter LLM: `#8b5cf6` (violet-500)
  - Vercel Blob: `#3b82f6` (blue-500)
- **Line Chart (MRR Trend)**:
  - Line stroke: `var(--accent-green)`
  - Gradient fill: `var(--accent-green)` to transparent.
- **Donut / Pie (Plan Breakdown)**:
  - Pro: `#10b981` (emerald)
  - Enterprise: `#a855f7` (purple)
  - Demo: `#3b82f6` (blue)
  - Free: `#525252` (neutral)

### Heatmap Color Scale (5-Bucket Quantile)
Used for raw SVG heatmaps (Cohort Retention & Hour-DOW usage). Colors blend from the `#1a1a1a` surface to a solid accent.
- **Bucket 0 (0 / Null)**: `#1a1a1a` (Surface)
- **Bucket 1 (1-25%)**: `bg-blue-500/20`
- **Bucket 2 (26-50%)**: `bg-blue-500/40`
- **Bucket 3 (51-75%)**: `bg-blue-500/70`
- **Bucket 4 (76-100%)**: `bg-blue-500`
*(Note: Cohort retention uses blue; if rendering an error-rate heatmap, substitute with red-500 opacities).*

### Table Density
- **Row Height**: `h-10` (40px) for standard data rows to maximize density.
- **Header**: `h-8` (32px), `text-xs uppercase text-[#a1a1a1] border-b border-[#2a2a2a]`.
- **Hover**: `hover:bg-[#1f1f1f]` on rows.
- **Sorted Column Indicator**: Active column header is `text-white` with an inline `↑` or `↓` arrow.
