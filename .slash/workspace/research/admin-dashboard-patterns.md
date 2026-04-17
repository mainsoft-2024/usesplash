# Research: SaaS Admin Dashboard UI Patterns 2025-2026

**Date:** 2026-04-15

**Project:** Splash — AI Logo Generation SaaS Admin Panel

---

## Executive Summary

This research compiles actionable design patterns for building a premium dark-themed admin dashboard tailored for an AI logo generation SaaS. Drawing from analysis of leading platforms including Vercel, Stripe, Linear, Clerk, PostHog, and contemporary admin dashboard templates (TailAdmin, Apex Dashboard, Flowbite, shadcn/ui-based templates), this document provides concrete layout recommendations, component specifications, and color schemes optimized for data-heavy SaaS administration.

Key findings: Premium dashboards in 2025-2026 favor the dark sidebar + light content pattern, but fully dark interfaces are gaining traction for developer/tools platforms. Sparklines and trend indicators have replaced traditional gauges. User tables now feature inline actions, status badges, and contextual sparklines. The 40-30-20-10 space allocation rule guides visual hierarchy, and OKLCh color tokens provide perceptually uniform theming.

---

## 1. Stats & Metrics in Premium SaaS Admin Panels

### 1.1 Primary KPI Hierarchy

Premium SaaS admin panels organize metrics using a **tiered hierarchy** that aligns with decision-making frequency:

| Tier | Allocation | Metrics Shown | Examples |
|------|------------|---------------|----------|
| **Primary** | 40% of viewport | Single most critical metric with trend | MRR, Total Active Users, API Calls |
| **Secondary** | 30% | 2-3 supporting KPIs | New Signups, Churn Rate, Conversion Rate |
| **Contextual** | 20% | Trend visualizations | Sparklines, comparison bars |
| **Navigation** | 10% | Filters, date ranges, export | Date pickers, export buttons |

**Source:** Improvado Dashboard Design Guide 2026

### 1.2 Common Metrics by Platform Type

For an AI logo generation SaaS, the following metrics are most relevant:

**Revenue & Growth**
- Monthly Recurring Revenue (MRR)
- Revenue Growth Rate (% vs. previous period)
- Average Revenue Per User (ARPU)
- Trial-to-paid conversion rate
- Failed payments / Churn rate

**User Engagement**
- Total Active Users (TAU)
- Monthly Active Users (MAU)
- Daily Active Users (DAU)
- User retention rate
- Session duration

**AI-Specific Metrics**
- Total generations count
- Generations per user (frequency)
- Success/failure rate of generations
- Average generation time
- Credits consumed per user

**Platform Health**
- API uptime
- Average response latency
- Error rate
- Queue depth (for async generation)

### 1.3 Metric Card Anatomy

The most effective metric cards combine three elements:

```tsx
// Pattern from Studio Admin template
<Card>
  <Label>Monthly Active Users</Label>           // Context (muted)
  <Value>48.2k</Value>                           // Primary (large, bold)
  <TrendIndicator>                              // Trend (+12.5% up)
    <Icon name="trending-up" />
    <Percentage>+12.5%</Percentage>
    <Period>vs last month</Period>
  </TrendIndicator>
  <Sparkline data={mauHistory} />               // Visual trend
</Card>
```

**Key components:**
- **Label**: Muted text, 12-14px, uppercase tracking
- **Value**: Large (24-36px), bold weight, high contrast
- **Trend indicator**: Colored (green positive, red negative), icon + percentage + comparison period
- **Sparkline**: 40-60px height, shows 7-30 day trend

---

## 2. Chart Types in Admin Dashboards

### 2.1 Chart Selection Decision Framework

The choice of chart type depends on three factors: data structure, user task, and cognitive load.

| Data Type | User Task | Recommended Chart | Why |
|-----------|-----------|-------------------|-----|
| Time series | See trend over time | **Line chart / Area chart** | Human eye detects slope changes instantly |
| 2-7 categories | Compare values | **Horizontal bar chart** | Length comparison is 2× more accurate than area/angle |
| 8+ categories | Compare & rank | **Sorted horizontal bar** | Sorting reveals top/bottom performers |
| Part-to-whole (3-5 parts) | See composition | **Stacked bar / Treemap** | Pie charts fail beyond 5 slices |
| Two continuous variables | Find correlation | **Scatter plot** | Shows relationship strength and outliers |
| Distribution | See shape/outliers | **Histogram / Box plot** | Histogram for shape, box plot for quartiles |

**Source:** Improvado Dashboard Design Guide 2026

### 2.2 Area Charts (Primary Trend Visualization)

Area charts are the dominant choice for time-series data in premium dashboards in 2025-2026. They show cumulative data and stackable trends effectively.

**Best practices:**
- Use **gradient fills** beneath lines for depth (not solid fills)
- Limit to **2-4 data series** per chart to prevent visual clutter
- Add **crosshair on hover** for precise value inspection
- Include **minimal axes** — primary value labels only

```tsx
// Example: Revenue over time
<AreaChart
  data={revenueData}
  series={[
    { key: 'mrr', name: 'MRR', color: '#6366f1' },
    { key: 'arr', name: 'ARR', color: '#8b5cf6' }
  ]}
  fillOpacity={0.2}
  curveType="monotone"
  showTooltip
  showAxisLabels={false}
/>
```

**Sources:** Flowbite Admin Dashboard, AnyChart Sparkline documentation

### 2.3 Sparklines (Trend Context at Glance)

Sparklines are word-sized charts that convey trend, shape, and variation in minimal space. They are now ubiquitous in premium dashboards.

**When to use sparklines:**
- In **summary tables** — add trend context to every row
- In **KPI dashboard cards** — show recent trend direction
- In **data-dense views** — when you need 20+ trends simultaneously
- When **trend direction matters more than exact values**

**Sparkline variants:**
| Type | Use Case | Visual |
|------|----------|--------|
| Line | Continuous trends (prices, usage) | Simple trend line |
| Bar | Discrete counts (daily signups, weekly commits) | Vertical bars |
| Area | Volume/magnitude emphasis | Filled region beneath line |

**Implementation pattern:**
```tsx
<Sparkline
  data={[10, 20, 40, 20, 40, 10, 50]}
  type="area"
  color="#06b6d4"
  height={40}
  fillOpacity={0.2}
  showEndDot        // Highlights last data point
  showMinMax        // Optional: highlights extremes
/>
```

**Key best practices (2025-2026):**
1. **Consistent Y-axis scaling** across all sparklines in a table
2. **No axes or labels** — let the table carry the numbers
3. **Highlight endpoint** with a subtle dot (helps readers locate "where we are now")
4. **High contrast colors** — dark blue (#1D4E89) or brand color on light; lighter accents on dark
5. **Group related sparklines** in a dedicated column

**Sources:** CleanChart Sparkline Guide, Mantine Sparkline, Chart.ts Sparkline

### 2.4 Trend Indicators

In addition to sparklines, trend indicators provide quick directional context:

```tsx
// Positive trend
<TrendIndicator type="positive">
  <Icon name="trending-up" />
  <Value>+23%</Value>
  <Label>vs. last quarter</Label>
</TrendIndicator>

// Negative trend (warning)
<TrendIndicator type="negative">
  <Icon name="trending-down" />
  <Value>-15%</Value>
  <Label>below plan</Label>
</TrendIndicator>
```

**Visual treatment:**
- **Green (#10b981)**: Positive trends, success states
- **Red (#ef4444)**: Negative trends, errors, warnings
- **Yellow (#f59e0b)**: Neutral/cautionary
- **Gray (#6b7280)**: No change, stable

---

## 3. User Management Table Patterns

### 3.1 Table Anatomy

Premium user management tables in 2025-2026 follow this structure:

```tsx
<Table>
  <TableHeader>
    <Column>User</Column>         // Avatar + Name + Email
    <Column>Status</Column>        // Badge (active/trial/churned)
    <Column>Plan</Column>          // Plan name
    <Column>Usage</Column>          // Sparkline or progress
    <Column>Joined</Column>         // Date
    <Column>Actions</Column>        // Menu
  </TableHeader>
  <TableBody>
    <Row>
      <Cell>
        <UserAvatar src={avatar} />
        <UserInfo>
          <Name>Jane Doe</Name>
          <Email>jane@example.com</Email>
        </UserInfo>
      </Cell>
      <Cell><Badge variant="success">Active</Badge></Cell>
      <Cell><PlanBadge>Pro</PlanBadge></Cell>
      <Cell><Sparkline data={usageHistory} /></Cell>
      <Cell><Date>Jan 15, 2026</Date></Cell>
      <Cell><ActionMenu items={menuItems} /></Cell>
    </Row>
  </TableBody>
</Table>
```

### 3.2 Column Patterns by Priority

**Essential columns:**
- User (avatar + name + email) — primary identifier
- Status — badge with color coding
- Plan — current subscription tier
- Actions — dropdown menu

**Contextual columns:**
- Usage sparkline — shows activity trend
- Last active date — engagement indicator
- Join date — account age
- Revenue — lifetime value
- API calls — usage volume

### 3.3 Status Badge Design

Status badges provide instant visual scanning:

| Status | Color | Background | Use Case |
|--------|-------|------------|----------|
| Active | Green | `bg-green-500/20 text-green-400` | Paying users |
| Trial | Blue | `bg-blue-500/20 text-blue-400` | On trial |
| Churned | Red | `bg-red-500/20 text-red-400` | Cancelled |
| Paused | Yellow | `bg-yellow-500/20 text-yellow-400` | Payment failed |
| Inactive | Gray | `bg-gray-500/20 text-gray-400` | No activity 30+ days |

```tsx
// Badge component pattern
<Badge variant="success">
  <Dot /> Active
</Badge>

<Badge variant="warning">
  <Dot /> Trial
</Badge>

<Badge variant="destructive">
  <Dot /> Churned
</Badge>
```

### 3.4 Table Features

Premium tables include these interactive features:

1. **Sorting** — click column headers to sort ascending/descending
2. **Filtering** — inline filters or filter dropdown
3. **Search** — global search with debounce
4. **Pagination** — configurable rows per page
5. **Row selection** — bulk actions on selected users
6. **Inline actions** — quick actions without opening detail page
7. **Expandable rows** — show additional details inline

### 3.5 User Table Example Layout

```
| User                  | Status    | Plan    | Usage (30d)    | Spent  | Joined    | Actions |
|-----------------------|-----------|---------|----------------|--------|-----------|---------|
| 🟢 Sarah Chen         | Active    | Pro     | ▁▂▅▇▅▂▃  | $49    | Jan 2026  | ⋮       |
| 🟡 Mike Rodriguez    | Trial     | Pro     | ▁▂▃▄▅▆▇  | $0     | Apr 2026  | ⋮       |
| 🔴 Alex Kim           | Churned   | Basic   | ▇▅▃▂▁▂▁  | $15    | Nov 2025  | ⋮       |
| ⚪ Jamie Wilson      | Inactive  | Pro     | ▁▁▁▁▁▁▁  | $49    | Dec 2025  | ⋮       |
```

---

## 4. Revenue & Usage Analytics Visualization

### 4.1 Revenue Dashboard Layout

Premium revenue dashboards combine multiple visualizations:

```
┌─────────────────────────────────────────────────────────────┐
│ Revenue Overview                                            │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ │ MRR          │ │ ARR          │ │ ARPU         │         │
│ │ $125,000     │ │ $1,500,000   │ │ $49          │         │
│ │ ↑ 12.5%      │ │ ↑ 12.5%      │ │ ↑ 5.2%       │         │
│ │ ▁▂▅▇▅▂▃     │ │ ▁▂▅▇▅▂▃     │ │ ▁▂▅▇▅▂▃     │         │
│ └──────────────┘ └──────────────┘ └──────────────┘         │
├─────────────────────────────────────────────────────────────┤
│ Revenue Over Time                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                    ▄▄▄▄▄▄███▄▄▄▄▄▄▄▄▄▄▄▄▄▄             │ │
│ │                ▄███▀▀▀▀▀▀▀▀▀████                        │ │
│ │              ▄██▀              ▀█                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│  Jan   Feb   Mar   Apr   May   Jun   Jul                  │
├─────────────────────────────────────────────────────────────┤
│ Revenue by Plan                                             │
│ ┌──────────────────────────┐ ┌──────────────────────────┐  │
│ │ Pro         ██████████  │ │ Basic       ████        │  │
│ │ $80k (65%)               │ │ $45k (35%)              │  │
│ └──────────────────────────┘ └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Usage Analytics (AI-Specific)

For an AI logo generation SaaS, usage analytics should visualize:

**Generation Metrics**
- Total generations over time (area chart)
- Success vs. failure rate (stacked bar)
- Average generation time (line chart)
- Credit consumption per user (bar chart)

**Visualization pattern:**
```tsx
<UsageDashboard>
  <MetricRow>
    <Card title="Total Generations" value="12,450" trend="+8.2%" />
    <Card title="Success Rate" value="94.2%" trend="+1.5%" />
    <Card title="Avg Generation Time" value="4.2s" trend="-12%" />
  </MetricRow>
  
  <ChartSection title="Generations Over Time">
    <AreaChart data={generationHistory} />
  </ChartSection>
  
  <ChartSection title="Usage by Plan">
    <StackedBar data={usageByPlan} />
  </ChartSection>
</UsageDashboard>
```

### 4.3 Stacked Area Charts (Multi-Series Trends)

For showing multiple metrics over time:

```tsx
<AreaChart
  type="stacked"
  data={[
    { date: 'Jan', pro: 4000, basic: 2400 },
    { date: 'Feb', pro: 3000, basic: 1398 },
    { date: 'Mar', pro: 2000, basic: 9800 },
  ]}
  series={[
    { key: 'pro', name: 'Pro', color: '#6366f1' },
    { key: 'basic', name: 'Basic', color: '#8b5cf6' }
  ]}
/>
```

**Best practice:** Use no more than **4 stacked series** to maintain readability.

### 4.4 Funnel Visualization (Conversion)

For trial-to-paid conversion:

```tsx
<FunnelChart
  stages={[
    { label: 'Total Signups', value: 1000, color: '#6366f1' },
    { label: 'Started Trial', value: 450, color: '#8b5cf6' },
    { label: 'Converted', value: 180, color: '#10b981' },
    { label: 'Churned', value: 45, color: '#ef4444' }
  ]}
/>
```

---

## 5. Dashboard Layout Patterns

### 5.1 Navigation Patterns

**Two dominant patterns in 2025-2026:**

| Pattern | Description | Examples | Best For |
|---------|-------------|----------|----------|
| **Dark Sidebar + Light Content** | Dark navigation panel, white/light content area | AdminLTE, GitHub, AWS Console | Enterprise, traditional SaaS |
| **Full Dark Mode** | Entire interface uses dark surfaces | Linear, Vercel, Stripe | Developer tools, modern SaaS |

#### 5.1.1 Dark Sidebar + Light Content (Most Common)

```
┌─────────────────────────────────────────────────────┐
│ Header: Logo | Search | User Menu                   │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│  Sidebar │         Main Content Area               │
│          │                                          │
│  - Dashboard      ┌─────────────────────────────┐  │
│  - Users          │  Page Title                  │  │
│  - Revenue        │  ─────────────────────────── │  │
│  - Analytics      │  Content / Charts / Tables  │  │
│  - Settings       │                               │  │
│          │  │                               │  │
│          │  └─────────────────────────────┘  │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

**Advantages:**
- Immediate visual hierarchy — sidebar anchors navigation
- White content area gives data and forms room to breathe
- Users are trained by decades of software to expect this pattern
- High contrast between dark sidebar and light content

**Source:** AdminLTE Best Color Schemes Guide

#### 5.1.2 Full Dark Mode (Rising Trend)

```
┌─────────────────────────────────────────────────────┐
│ Top Nav: Logo | Search | Nav Links | User Menu      │
├─────────────────────────────────────────────────────┤
│                                                     │
│         Main Content Area (Dark Background)        │
│                                                     │
│  ┌─────────────────────┐  ┌─────────────────────┐│
│  │  Metric Card        │  │  Metric Card         ││
│  └─────────────────────┘  └─────────────────────┘│
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Chart / Table                               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Advantages:**
- Reduced eye strain for long sessions (developer tools, analytics)
- Modern, sleek aesthetic
- Better for OLED screens (battery savings)
- Consistent immersion

**Examples:** Linear, Vercel dashboard, Horizon UI, Black Dashboard

### 5.2 Grid System & Spacing

The **12-column grid** is standard for dashboard layouts:

```
Primary elements: 6-8 columns
Secondary elements: 3-4 columns
Tertiary elements: 2-3 columns
```

**Spacing rules:**
- 16px between elements (small gaps)
- 32px between sections (medium gaps)
- 48px margins (page edges)
- Use consistent spacing throughout

**Source:** Improvado Dashboard Design Guide 2026

### 5.3 Widget Grid Layout

**Common widget arrangements:**

```
┌─────────────┬─────────────┬─────────────┐
│   Metric    │   Metric    │   Metric    │  <- 3-column row
│   Card 1    │   Card 2    │   Card 3    │
├─────────────┴─────────────┴─────────────┤
│         Large Chart (full width)         │  <- Chart section
├────────────────────┬────────────────────┤
│     Table          │    Details          │  <- 2-column split
│     (60%)          │    Panel (40%)       │
└────────────────────┴────────────────────┘
```

### 5.4 Collapsible Sidebar Pattern

For compact views, collapsible sidebars are standard:

```tsx
<Sidebar collapsible defaultExpanded>
  <SidebarGroup>
    <SidebarItem icon={LayoutDashboard} href="/">Dashboard</SidebarItem>
    <SidebarItem icon={Users} href="/users">Users</SidebarItem>
    <SidebarItem icon={DollarSign} href="/revenue">Revenue</SidebarItem>
  </SidebarGroup>
  <SidebarGroup collapsible>
    <SidebarGroupLabel>Analytics</SidebarGroupLabel>
    <SidebarItem icon={BarChart} href="/analytics/usage">Usage</SidebarItem>
    <SidebarItem icon={Activity} href="/analytics/api">API</SidebarItem>
  </SidebarGroup>
</Sidebar>
```

**Features:**
- Toggle button to collapse/expand
- Icons-only when collapsed
- Remembers user preference (localStorage)
- Mobile: collapses to hamburger menu / sheet drawer

**Source:** shadcn/ui Sidebar component

### 5.5 Command Palette (Cmd+K)

Premium dashboards in 2025-2026 include a command palette for quick navigation:

```tsx
<CommandDialog>
  <CommandInput placeholder="Search pages, users, actions..." />
  <CommandGroup heading="Pages">
    <CommandItem>Dashboard</CommandItem>
    <CommandItem>Users</CommandItem>
    <CommandItem>Revenue</CommandItem>
  </CommandGroup>
  <CommandGroup heading="Recent">
    <CommandItem>View User: sarah@example.com</CommandItem>
    <CommandItem>Export: March Revenue</CommandItem>
  </CommandGroup>
</CommandDialog>
```

**Implementation:** shadcn/ui Command component (based on cmdk)

**Trigger:** `Cmd+K` / `Ctrl+K` global shortcut

---

## 6. Dark Theme Color Schemes & Visual Hierarchy

### 6.1 Recommended Color Palette for AI Logo SaaS

Based on analysis of premium dashboards, here is a recommended dark theme palette:

#### 6.1.1 Base Colors (Dark Mode)

| Role | Hex Code | Usage |
|------|----------|-------|
| Background (base) | `#0f0f0f` | Page background |
| Surface (cards) | `#1a1a1a` | Card backgrounds |
| Surface (elevated) | `#242424` | Hover states, modals |
| Border | `#2a2a2a` | Dividers, card borders |
| Sidebar | `#141414` | Sidebar background |

#### 6.1.2 Text Colors

| Role | Hex Code | Usage |
|------|----------|-------|
| Primary text | `#ffffff` | Headings, important values |
| Secondary text | `#a1a1a1` | Labels, descriptions |
| Muted text | `#6b6b6b` | Placeholders, disabled |

**Opacity-based hierarchy (alternative approach):**
- Disabled: `#ffffff` at 38%
- Secondary: `#ffffff` at 60%
- Primary: `#ffffff` at 87%

#### 6.1.3 Accent Colors

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Primary | Violet | `#8b5cf6` | Primary actions, brand |
| Success | Emerald | `#10b981` | Positive trends, active |
| Warning | Amber | `#f59e0b` | Warnings, trial status |
| Error | Red | `#ef4444` | Errors, churned status |
| Info | Cyan | `#06b6d4` | Information, links |

### 6.2 Visual Hierarchy Principles

#### 6.2.1 40-30-20-10 Space Rule

Allocate screen space strategically:

- **40%** — Primary KPI (single most important metric)
- **30%** — 2-3 secondary KPIs
- **20%** — Trend context (sparklines, comparison bars)
- **10%** — Navigation and filters

This prevents the "democratic layout" trap where all metrics receive equal space.

#### 6.2.2 F-Pattern Layout

Research shows users scan dashboards in an F-pattern:
1. Top-left → top-right (horizontal scan)
2. Left side (vertical scan)
3. Continue scanning horizontally at lower point

**Implication:** Place most important metrics in the top-left quadrant.

#### 6.2.3 Contrast Guidelines

| Element | Contrast Ratio | Example |
|---------|----------------|---------|
| Primary text | 7:1 (AAA) | White on dark gray |
| Secondary text | 4.5:1 (AA) | Light gray on dark |
| Large text (18px+) | 3:1 (AA Large) | Headlines |
| UI components | 3:1 | Borders, icons |

### 6.3 Dark Theme Implementation Patterns

#### 6.3.1 Using OKLCh Color Tokens

Modern dashboards (Apex Dashboard, TailAdmin) use OKLCh for perceptually uniform colors:

```css
:root {
  /* Light mode */
  --background: oklch(0.985 0.002 230);
  --foreground: oklch(0.155 0.015 230);
  --primary: oklch(0.55 0.175 160);    /* Teal */
  --primary-foreground: oklch(0.985 0.002 230);
}

.dark {
  /* Dark mode */
  --background: oklch(0.145 0.015 230);
  --foreground: oklch(0.985 0.002 230);
  --primary: oklch(0.65 0.19 160);
  --primary-foreground: oklch(0.145 0.015 230);
}
```

**Advantages of OKLCh:**
- Perceptually uniform (equal perceptual distance between colors)
- Hue rotation preserves perceived color shifts
- Better for accessibility

#### 6.3.2 Semantic Color Tokens

Use semantic naming rather than raw color values:

```css
/* Instead of: */
.bg-blue-500
.text-green-400

/* Use: */
.bg-primary          /* Brand color */
.bg-success          /* Positive state */
.bg-warning          /* Caution state */
.bg-error            /* Error/destructive */
.bg-muted            /* Secondary backgrounds */
```

### 6.4 Dark Theme Best Practices

**DO:**
- ✅ Use **dark grays** (#1a1a1a, #242424) instead of pure black
- ✅ Reduce saturation for dark-mode colors
- ✅ Test in different lighting conditions
- ✅ Use elevated surfaces (higher lightness) for interactive elements
- ✅ Add subtle shadows for depth

**DON'T:**
- ❌ Use pure black (#000000) — causes eye strain
- ❌ Use pure white (#ffffff) for primary text — too harsh
- ❌ Use bright, saturated colors as backgrounds
- ❌ Simply invert light mode colors
- ❌ Forget to test accessibility (contrast ratios)

### 6.5 Recommended Palette for Splash

For an AI logo generation SaaS with a modern, creative feel:

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Background | `#f8fafc` | `#0a0a0a` |
| Surface | `#ffffff` | `#171717` |
| Surface Elevated | `#f1f5f9` | `#262626` |
| Border | `#e2e8f0` | `#2e2e2e` |
| Primary Text | `#0f172a` | `#fafafa` |
| Secondary Text | `#64748b` | `#a1a1a1` |
| Primary Accent | `#8b5cf6` (Violet 500) | `#a78bfa` (Violet 400) |
| Success | `#10b981` | `#34d399` |
| Warning | `#f59e0b` | `#fbbf24` |
| Error | `#ef4444` | `#f87171` |

---

## 7. Recommended Implementation Stack

Based on this research, here is the recommended implementation approach:

### 7.1 Component Library

| Recommendation | Alternative |
|----------------|-------------|
| **shadcn/ui** | TailAdmin, Apex Dashboard |
| Tailwind CSS v4 | Bootstrap 5.3 (if needed) |
| Radix UI (underlying) | Headless UI |

**Why shadcn/ui:**
- Production-ready components
- Built on Radix UI primitives (accessible)
- Tailwind CSS styling (customizable)
- Dark mode support via next-themes
- Command palette component (Cmd+K)
- Sidebar component (collapsible)

### 7.2 Chart Libraries

| Recommendation | Use Case |
|----------------|----------|
| **Recharts** | Primary — React-native, declarative |
| **Tremor** | Dashboards — built for SaaS |
| **VisActor** | Complex visualizations |
| **Chart.js** | Simpler needs |

**For sparklines specifically:**
- **Chart.ts Sparkline** — lightweight, TypeScript
- **Mantine Charts Sparkline** — if using Mantine
- **Custom SVG** — simple sparklines can be hand-coded

### 7.3 Recommended Dashboard Structure

```
/admin
├── layout.tsx              # Sidebar + header
├── page.tsx               # Dashboard overview
├── users/
│   └── page.tsx           # User management
├── revenue/
│   └── page.tsx           # Revenue analytics
├── analytics/
│   ├── usage/page.tsx     # Usage metrics
│   └── api/page.tsx       # API health
└── settings/
    └── page.tsx           # Admin settings
```

---

## 8. Quick Reference: Implementation Checklist

### Dashboard Overview Page
- [ ] 3-4 primary KPI cards (MRR, Users, Conversions, API Calls)
- [ ] Revenue trend area chart (full width)
- [ ] User activity sparklines table
- [ ] Date range filter
- [ ] Export functionality

### User Management Page
- [ ] Searchable, sortable table
- [ ] Status badges (Active/Trial/Churned/Paused)
- [ ] Inline usage sparklines
- [ ] Row actions (view, edit, suspend)
- [ ] Bulk selection and actions

### Revenue Page
- [ ] MRR/ARR/ARPU cards with trend indicators
- [ ] Revenue over time area chart
- [ ] Revenue by plan stacked bar
- [ ] Recent transactions table

### Dark Theme
- [ ] Use CSS custom properties (OKLCh recommended)
- [ ] Test contrast ratios (minimum 4.5:1 for text)
- [ ] Avoid pure black backgrounds
- [ ] Reduce saturation in dark mode
- [ ] Consistent surface hierarchy

---

## References

- Improvado Dashboard Design Guide 2026 — https://improvado.io/blog/dashboard-design-guide
- Studio Admin Dashboard Template — https://next-shadcn-admin-dashboard.vercel.app/
- TailAdmin Dashboard — https://tailadmin.com/
- Flowbite Admin Dashboard — https://flowbite-admin-dashboard.vercel.app/
- AnyChart Sparkline Documentation — https://www.anychart.com/products/anychart/gallery/Sparkline_Charts/
- CleanChart Sparkline Guide — https://www.cleanchart.app/blog/how-to-create-sparkline
- Mantine Sparkline Component — https://mantine.dev/charts/sparkline/
- Chart.ts Sparkline Documentation — https://chartts.com/docs/charts/sparkline
- shadcn/ui Table Component — https://ui.shadcn.com/docs/components/table
- AdminLTE Best Color Schemes Guide — https://adminlte.io/blog/best-admin-dashboard-color-schemes/
- Colorlib Dark Admin Dashboard Templates — https://colorlib.com/wp/dark-admin-dashboard-templates/
- shadcn/ui Sidebar Component — https://ui.shadcn.com/docs/components/sidebar
- BootstrapDash Dark Mode Guide — https://www.bootstrapdash.com/blog/dark-mode-in-tailwind-css-dashboards/
