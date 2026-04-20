# admin-dashboard-insights

## Purpose
Provide a tab-based admin insights dashboard that makes cost, revenue, user health, and operational risk visible in one place.

## Requirements

### Requirement: Tab-based admin dashboard layout
The admin dashboard at `/admin` SHALL present five tabs in this order: `개요`, `비용`, `수익`, `사용자`, `자료`. The active tab SHALL be reflected in the URL as `?tab=<id>` so tabs are deep-linkable and bookmarkable.

#### Scenario: Admin visits /admin?tab=cost
- **WHEN** an authenticated admin opens `/admin?tab=cost`
- **THEN** the "비용" tab content is rendered and marked active

#### Scenario: Invalid tab query param
- **WHEN** URL has `?tab=nonsense`
- **THEN** the dashboard falls back to `개요` tab and does not throw

### Requirement: Dashboard date range control
The dashboard SHALL provide a global period selector with values `7일 / 30일 / 90일 / 전체`, default `30일`. The chosen period SHALL apply to every widget that is time-ranged on the current tab.

#### Scenario: Operator switches to 90일
- **WHEN** operator clicks the 90일 button
- **THEN** every chart, KPI trend, cost total, and funnel on the current tab re-queries for the 90-day window

#### Scenario: Operator switches to 전체
- **WHEN** operator selects 전체
- **THEN** the range is unbounded (`gte` constraint removed) and widgets show lifetime numbers

### Requirement: Admin-only access
All admin-insights tRPC procedures SHALL be protected by the existing `adminProcedure` middleware. Non-admin users MUST receive an UNAUTHORIZED error.

#### Scenario: Non-admin attempts to query
- **WHEN** a `free` tier user calls `trpc.admin.*`
- **THEN** the server responds with UNAUTHORIZED and no data leaks

### Requirement: Cumulative API cost chart
The dashboard SHALL render a stacked area chart of daily API cost broken down by source (`gemini_image`, `openrouter_llm`, `vercel_blob`) across the selected period. Y-axis unit = USD.

#### Scenario: Period = 30일 with data in every source
- **WHEN** operator views 비용 탭
- **THEN** the chart displays three stacked layers with a legend and tooltip showing per-source USD per day

### Requirement: MRR dashboard widget
The 수익 탭 SHALL show a KPI row with: `MRR`, `MRR MoM %`, `ARR`, `Active paid subs`, `Weekly churn %`.

#### Scenario: Dashboard loads
- **WHEN** admin opens 수익 탭
- **THEN** all five KPIs are visible above the fold with trend indicators

### Requirement: Margin and burn-rate widget
The 개요 탭 SHALL show this-month margin (USD), margin %, and 30-day burn rate.

#### Scenario: Margin % < 70
- **WHEN** computed margin% is under 70
- **THEN** a yellow threshold banner reading "이번 달 총마진이 70% 아래입니다" appears at the top of the dashboard (all tabs)

### Requirement: User ranking tables
The 사용자 탭 SHALL show three tables, each capped at 20 rows, sortable by the ranking metric: `Top spenders (총 지출 = sum of PLAN_PRICE_USD × monthsActive)`, `Top cost users (누적 API 비용)`, `Margin ranking (LTV - 누적 API 비용)`.

#### Scenario: Operator sorts by margin
- **WHEN** operator opens 사용자 탭 and looks at the margin table
- **THEN** users are listed from highest (most profitable) to lowest (money pit)

### Requirement: Activation funnel
The 개요 탭 SHALL show a 4-stage funnel: `Signup → 첫 Project → 첫 UsageLog → 첫 Pro/Enterprise 구독`, each stage displaying absolute count and conversion % from the previous stage.

#### Scenario: 1000 signups, 200 projects, 150 generations, 10 paid
- **WHEN** operator views the funnel
- **THEN** stages show 1000 (100%), 200 (20%), 150 (75% of prev), 10 (6.7% of prev)

### Requirement: Weekly cohort retention heatmap
The 자료 탭 SHALL render a retention heatmap with rows = weekly signup cohorts (last 12 weeks, most recent on top) and columns = `W0, W1, …, W7`. Cell color intensity encodes the percentage of that cohort that generated at least one logo in that week.

#### Scenario: Cohort with no one retained
- **WHEN** a cohort had all zero in W1..W7
- **THEN** those cells render as the lowest-intensity color, not blank

### Requirement: Hour-of-day × day-of-week heatmap
The 개요 탭 SHALL render a 24×7 heatmap (x=hour 0..23 in KST, y=Mon..Sun) colored by generation count.

#### Scenario: Night spike
- **WHEN** most generations occur 22:00–02:00
- **THEN** the heatmap's bottom-right region is visibly darker/warmer than the morning

### Requirement: Gemini rate-limit and error panel
The 개요 탭 SHALL show three KPIs derived from `GeminiRequestLog`: `429 rate (last 24h)`, `overall error rate (last 24h)`, `avg retries per successful request (last 24h)`.

#### Scenario: Error rate exceeds 5%
- **WHEN** `failed / total > 0.05` over the last 24h
- **THEN** a red threshold banner appears at the top of the dashboard

### Requirement: Real-time-ish activity feed
The 자료 탭 SHALL show a reverse-chronological event timeline merging `UsageLog` and `Subscription` tier-change events with a 수동 새로고침 button. Infinite scroll via cursor pagination with page size 50.

#### Scenario: Admin scrolls to bottom
- **WHEN** admin reaches the last loaded item
- **THEN** the next 50 events load automatically

#### Scenario: Admin clicks refresh
- **WHEN** refresh is clicked
- **THEN** the list resets to the newest 50 events

### Requirement: Popular keywords/styles chart
The 자료 탭 SHALL show a horizontal bar chart of the top 15 keywords/styles from `Logo.prompt` over the selected period, matched against a static dictionary in `web/src/lib/style-keywords.ts`.

#### Scenario: "minimalist" appears in 40% of prompts
- **WHEN** operator views the chart
- **THEN** "minimalist" is the longest bar at the top with its count and percentage

### Requirement: Sample gallery
The 자료 탭 SHALL render a 6×4 grid of the 24 most recent `LogoVersion` thumbnails, each linking to its originating user in `/admin/users/[id]`.

#### Scenario: Click a logo
- **WHEN** admin clicks a thumbnail
- **THEN** browser navigates to the user detail page for the logo's owner

### Requirement: Enhanced user search
The 사용자 탭 SHALL provide filters for: `tier` (multi-select), `활성도 = 최근 7일 생성 유무`, `가입일 범위` (date range picker), plus the existing `이름/이메일` text search.

#### Scenario: Filter to inactive pro users
- **WHEN** admin selects tier=pro AND 활성도=inactive
- **THEN** only pro users with 0 generations in the last 7 days are listed

### Requirement: CSV export
The 사용자 탭 SHALL provide a `CSV 내보내기` button that downloads the currently filtered user list as CSV with columns: id, name, email, tier, signupDate, totalGenerations, totalCostUsd, LTV, margin.

#### Scenario: Admin exports filtered list
- **WHEN** admin clicks the CSV button with filters applied
- **THEN** a file `users-{YYYYMMDD}.csv` downloads containing only the filtered rows

### Requirement: Threshold alert banners
The dashboard SHALL show dismissible alert banners at the top (above tabs) whenever any of these conditions are true, computed on every dashboard load:
- Gross margin % this month < 70 (yellow)
- Gemini error rate last 24h > 5% (red)
- MRR MoM growth < 0 (yellow)

#### Scenario: Admin dismisses a banner
- **WHEN** admin clicks the × on a banner
- **THEN** the banner stays hidden for the rest of the browser session (sessionStorage) but reappears in new sessions

#### Scenario: Two conditions true simultaneously
- **WHEN** margin% is 60 AND error rate is 8%
- **THEN** both banners render stacked (red above yellow)
