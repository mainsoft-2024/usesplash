# Research: AI-SaaS Admin/Operator Dashboard UX Patterns

**Date:** 2026-04-21  
**Context:** Splash — Next.js AI logo generator, dark-themed, CEO/operator-centric dashboard redesign

---

## Executive Summary

This research synthesizes best-in-class patterns from Stripe, Linear, Vercel Analytics, PostHog, Supabase, and Railway to define a dashboard architecture for a small AI-SaaS team. The current Splash admin has KPI cards, one area chart, user table, and activity feed — but lacks MRR tracking, cost visibility, cohort analysis, and funnel metrics.

**Key findings:**
- Tremor (built on Recharts) is the fastest path to production-quality SaaS dashboards — weeks faster than raw Recharts
- Recharts v3 remains dominant (2.4M weekly downloads) and handles all required chart types
- Cohort retention curves are the highest-signal visualization for AI-SaaS — activation timing drives long-term retention
- FinOps dashboards require cost-per-unit (cost per AI query, cost per user) not just total spend
- Dark mode dashboards work best with semantic colors and careful contrast ratios

---

## 1. Layout Patterns from Competitors

### 1.1 Stripe Dashboard — The Revenue Command Center

**Reference:** https://dashboard.stripe.com (Stripe merchant dashboard)

**Layout anatomy:**
| Section | Components | Why It Works |
|---------|------------|-------------|
| Hero row | 4 KPI cards — Gross volume, Net revenue, Active subscriptions, Failed payments | First-glance health check |
| Primary chart | MRR trend line (12 months) with drill-down | Revenue trajectory at a glance |
| Secondary panels | Churn by plan, Revenue by geographic region | Segmentation without noise |
| Activity sidebar | Recent charges, Subscription lifecycle events | Operational awareness |

**Screenshot-worthy element:** Stripe's drill-down interaction — click any chart data point to see the underlying table. This transforms dashboards from passive views to active tools.

**Why it's good:** Stripe separates "what happened" from "why it happened" — trend charts show the headline, drill-down tables reveal the detail. The hierarchical navigation (overview → segment → customer) matches how operators actually think.

**Splash mapping:** Apply to our revenue metrics — overview card shows total MRR, click-through shows breakdown by plan (Free / Pro / Team).

---

### 1.2 Linear — Dark Mode Dashboard Reference

**Reference:** https://linear.app/insights (Linear Insights)

**Visual language:**
- Deep charcoal background (`#0D0D0D` to `#1A1A1A`)
- Accent color: Electric blue (`#5E6AD2`) for primary actions
- Subtle borders (`#2D2D2D`) for card separation
- High-contrast text: `#FFFFFF` (primary), `#9CA3AF` (secondary)

**Layout anatomy:**
| Row | Content | Pattern |
|-----|---------|---------|
| Top | 2×2 KPI cards with sparklines | "Are we on target for X?" questions |
| Middle | Main trend chart (full width) | Time-series with annotations |
| Bottom | Modular charts (BarList, Tracker) | Configurable by team/role |

**Screenshot-worthy element:** The modular dashboard builder — drag-and-drop widgets, customizable layouts per team. Enterprise customers build dozens of dashboards; the pattern is "fewer is better" — median workspace has 2 dashboards.

**Why it's good:** Linear pioneered the "dashboard as modular widget" approach. Each widget is self-contained — title, chart, legend, filter. No global state complexity.

**Splash mapping:** Our admin needs modular panels: revenue module, usage module, activity module. Each independently refreshable.

---

### 1.3 Vercel Analytics — Usage-First Dashboard

**Reference:** https://vercel.com/dashboard (Vercel dashboard → Usage tab)

**Layout anatomy:**
| Section | Metrics | Presentation |
|---------|---------|--------------|
| Hero | Current billing period spend | Large number + trend arrow |
| Usage breakdown | Serverless Functions, Edge, Web Analytics, DB | Horizontal bar chart |
| Alerts | Budget threshold warnings | Conditional color (green/yellow/red) |

**Visual pattern:** Cost-per-service stacked bars — each bar segment is a service. Immediate visibility into which workload drives spend.

**Screenshot-worthy element:** The budget guardrails — set spend limits and get automatically alerted or action-taken when approaching limits. FinOps as a control system, not just visibility.

**Splash mapping:** Our AI query costs need this — breakdown by: Gemini API calls, storage operations, database queries. Each segment trackable.

---

### 1.4 PostHog — Product Analytics as Dashboard

**Reference:** https://app.posthog.com (PostHog dashboard)

**Layout anatomy:**
| Section | Components | Purpose |
|---------|------------|----------|
| Insights sidebar | Trend, Funnel, Retention, User Paths, Lifecycle | Chart type selector |
| Main canvas | Configurable dashboard with widgets | Modular insight tiles |
| Filters | Date range, property filters, cohort selector | Context control |

**PostHog's "card title formula":** Question + Scope + Target/Δ  
Example: "Are we on target for MRR (MTD)? — All plans • Global • Last 30 days vs prior 30"

**Screenshot-worthy element:** The cohort filter integration — build a cohort in one UI, immediately use it as a filter in any dashboard insight. This loops product analytics into business metrics.

**Why it's good:** PostHog demonstrates "product behavior connects to business outcomes" — filter insights by "paying users cohort" to see feature adoption rates correlated with retention.

**Splash mapping:** Filter our usage charts by subscription tier — are free users actually reaching activation (first logo generation)? Are paying users exporting?

---

### 1.5 Supabase — Infrastructure-Focused Dashboard

**Reference:** https://supabase.com/dashboard (Project → Reports)

**Reports structure:**
| Report | Charts | Audience |
|--------|-------|----------|
| API Gateway | Total Requests, Response Errors, Response Speed, Top Routes | Backend engineering |
| Database | CPU, Memory, Storage, Connection Pool | DevOps |
| Realtime | Connected Clients, Broadcast Events, Lag | Real-time features |
| Auth | Active Users, Sign Ups, MFA adoption | Growth |

**Screenshot-worthy element:** Time range selector with plan-based access — Free = 24 hours, Pro = 7 days, Enterprise = 28 days. Default to appropriate range for plan tier.

**Why it's good:** Supabase separates observability by product area — different teams own different dashboards. The reports are "actionable by role."

**Splash mapping:** Reports by service area: "API (Gemini calls)" / "Storage ( blob operations)" / "Auth (signups, logins)."

---

### 1.6 Railway — Cost-Centric Dashboard

**Reference:** https://railway.app/dashboard (Project → Usage)

**Layout anatomy:**
| Section | Metrics | Presentation |
|---------|---------|--------------|
| Period summary | Current usage, Estimated end-of-period | Dual comparison |
| Usage chart | Cumulative usage over billing period | Area chart with deployment markers |
| Breakdown | By service, by environment | Categorized bars |

**Screenshot-worthy element:** Deployment markers on usage charts — each deployment is a vertical line. Immediately see which commit caused a resource spike. This connects code changes to cost changes.

**Why it's good:** Engineering-friendly cost visibility — the question "why did our bill spike?" is answerable by looking at deployment times.

**Splash mapping:** Mark AI batch generation runs on our cost chart — connect image generation bursts to cost spikes.

---

## 2. MRR / ARR / Churn / LTV Visualization Patterns

### 2.1 MRR Movement Chart (Waterfall)

**Pattern:** MRR breakdown by movement type  
**Implementation:** Stacked bar or waterfall chart  
**Components:**
- New MRR (new customers)
- Expansion MRR (upgrades within existing)
- Contraction MRR (downgrades)
- Churned MRR (cancellations)
- Reactivation MRR (returning customers)

**Reference:** https://chartsy.app (Stripe analytics dashboard builder)

**Screenshot-worthy element:** The MRR waterfall — each bar shows movement from prior month. Green expansions above the line, red contractions below. Net is the delta.

**Splash mapping:** We need MRR from subscriptions + one-time (credit packs). Track separately — subscriptionMRR vs consumptionMRR.

---

### 2.2 Net New MRR Bars

**Pattern:** Stacked bar showing MRR composition  
**Visual:** Month-over-month comparison  
**Reference:** Chartsy / Stripe native analytics

**Formula:**
```
Net New MRR = (New + Expansion + Reactivation) - (Contraction + Churn)
```

**Splash mapping:** Simple monthly bars with color coding: Green = expansion, Red = churn. One chart answers "are we growing?"

---

### 2.3 Churn Rate Trend

**Pattern:** Dual-axis line chart  
- Left axis: Revenue churn % (red line)
- Right axis: Logo churn % (gray line)
- Reference line: Industry benchmark (~5% monthly for SMB SaaS)

**Reference:** MCP Analytics (https://mcpanalytics.ai/articles/saas__generic__customers__cohort_retention)

**Screenshot-worthy element:** The "churn velocity" indicator — if revenue churn > logo churn, we're losing high-value customers. The gap signals expansion revenue erosion.

**Splash mapping:** Track churn by plan — are Pro users churning at different rates than Free? This informs retention strategy.

---

### 2.4 LTV Visualization

**Pattern:** Cohort-based LTV curves  
**Visual:** Line chart showing average revenue per cohort over time (months since signup)  
**Curve shape:** Flattening indicates "true" LTV

**Reference:** https://mcpanalytics.ai/articles/saas-revenue-analysis

**Formula:**
```
LTV = ARPU × Gross Margin % × Average Customer Lifetime
```

**Splash mapping:** Calculate by cohort (monthly sign-up cohort). Track how LTV evolves — newer cohorts should show improving LTV if product is improving.

---

## 3. Cost-vs-Revenue Dashboards (FinOps)

### 3.1 Gross Margin Panel

**Pattern:** Revenue — COGS = Gross Margin  
**Components:**
- Total Revenue (MRR)
- Cost of Goods Sold (AI API costs, infrastructure)
- Gross Margin % (target: 70%+ for SaaS)

**Reference:** CloudZero FinOps (https://www.cloudzero.com/blog/finops-for-saas)

**Screenshot-worthy element:** Unit economics dashboard — cost per customer, cost per API request, cost per AI query. The core question: "What does it cost to serve this customer?"

---

### 3.2 Burn Rate Dashboard

**Pattern:**  
- Total cloud spend (current month)
- Projected month-end
- Runway (months remaining at current burn)
- Reference line: Budget threshold

**Reference:** Vercel Usage Dashboard + Vantage integration (https://vercel.com/changelog/access-billing-usage-cost-data-api)

**FinOps best practices (from FinOps.org):**
| KPI | Formula | Target |
|-----|---------|--------|
|Commitment Coverage|% of spend on reserved capacity|40-60% for predictable workloads|
|Waste Percentage|Idle/unused resources|<10% is good, >20% is action needed|
|Cost per Transaction|Cost / Total transactions|Benchmark over time|

---

### 3.3 Cost Allocation Heatmap

**Pattern:** Cost by team/project/tag  
**Visual:** Stacked bar or heatmap matrix  
**Reference:** CloudZero (tag-based allocation) + Vantage (Vercel integration)

**Splash mapping:**
| Tag | Cost Driver | Allocation |
|-----|-----------|-----------|
|gemma:Coinference|Gemini API calls|By generation|
|storage:blob|Vercel Blob|By storage used|
|db:Neon|PostgreSQL|By connection|

---

### 3.4 AI-Specific Cost Patterns

**Pattern:** Cost per AI operation  
**Reference:** LeanOps (https://leanopstech.com/blog/cloud-unit-economics-saas-cost-per-api-customer-ai-query/)

**Key metrics for AI-SaaS:**
- Cost per AI Query = Total AI Infrastructure Cost / Total AI Queries
- Cost per Image Generation = Total Image Gen Cost / Total Generations
- Revenue per AI Query = (ARPU × Margin) / Queries per user

**Screenshot-worthy element:** The margin health indicator — if Cost per AI Query > 25% of revenue per query, margin is under pressure. Alert when trending above threshold.

**Splash mapping:**
- Track: Gemini API cost per generation (including retries)
- Track: Average generations per paying user
- Compare: Cost to LTV ratio — should be <20%

---

## 4. User-Level Insights

### 4.1 Top Users by Usage

**Pattern:** Leaderboard table  
**Columns:**
- User (name/email)
- Usage metric (generations, storage, API calls)
- Revenue tier
- Last active date

**Reference:** Vercel Usage by project (https://docs.railway.app/reference/project-usage)

**Screenshot-worthy element:** Sortable columns with trend indicators — "up" / "down" arrows showing usage velocity.

**Splash mapping:** Top 10 users by generation count. These are power users — potential beta testers, case study candidates.

---

### 4.2 Power-User vs Churn-Risk Segmentation

**Pattern:** RFM-style segmentation  
**Dimensions:**
- Recency: Days since last session
- Frequency: Sessions per week
- Monetization: Plan tier, usage

**Reference:** PostHog cohorts (https://posthog.com/docs/features/cohorts)

**Cohort definitions:**
- Power users: 10+ generations/week, active in last 7 days
- At-risk: No session in 21+ days, Free tier
- Churned: Subscription cancelled, no activity in 30 days

**Screenshot-worthy element:** The "at-risk" cohort badge with automatic enrollment. PostHog auto-updates cohorts daily.

**Splash mapping:** Build static cohorts: "Power Users (Pro)", "At-Risk (Free)", "Churned". Target email campaigns by cohort.

---

### 4.3 Cohort Retention Curve

**Pattern:** Multiple lines on one chart  
**X-axis:** Days/Weeks since signup  
**Y-axis:** % retained  
**Each line:** Monthly signup cohort

**Reference:** PostHog Retention (https://posthog.com/docs/product-analytics/retention) + The Growth Terminal (https://thegrowthterminal.com/blog/cohort-retention-curves-how-to-read-them-like-a-growth-engineer/)

**How to read the curve:**
- Healthy: Steep drop early (first 7 days) → flatline → slight rise
- Problem: High steady churn → curve never flattens
- Improvement signal: Newer cohorts flatten at higher % than older cohorts

**Screenshot-worthy element:** The cohort heatmap table — row = cohort month, column = days since signup, cell = % retained. Color intensity = retention strength.

**Splash mapping:**
- Activation milestone: First logo generation (Day 0-7)
- Stickiness threshold: 3+ generations in first 30 days
- Track cohorts by signup month, compare retention at 30/60/90 days.

---

### 4.4 User-Level Revenue Attribution

**Pattern:** Connect product usage to revenue  
**Visual:** Scatter plot or table  
**Dimensions:**
- X: Feature adoption (generations, exports)
- Y: Revenue
- Color: Plan tier

**Reference:** PostHog with Stripe integration

**Splash mapping:** Feature adoption by plan — are users who export SVGs more likely to convert to Pro? This informs which features to emphasize.

---

## 5. Activity Feed / Real-Time Event Stream

### 5.1 Activity Feed Patterns

**Event types for SaaS:**
- Customer events: Signup, First project, First generation, Subscribe, Upgrade, Cancel
- System events: Large batch completion, Error spike, Payment failure
- Admin events: Manual interventions, Feature flags changed

**Reference:** Real-time pattern from GetStream (https://getstream.io/blog/scalable-activity-feed-architecture/)

**Transport options:**
| Method | Latency | Complexity | Use Case |
|--------|---------|------------|----------|
|Polling|30s+|Low|Most dashboards|
|SSE|Sub-second|Medium|Activity feeds|
|WebSocket|Sub-second|High|Chat/collaborative|

**Recommendation:** SSE (Server-Sent Events) for admin activityfeeds — simpler than WebSocket, sufficient for one-way updates.

---

### 5.2 Feed Card Anatomy

**Reference:** Linear Inbox, PostHog events

**Card structure:**
| Field | Content |
|-------|----------|
|Icon|Type indicator (user, system, admin)|
|Timestamp|Relative ("2 min ago")|
|Primary text|"User X created project Y"|
|Metadata|System/plan info (optional)|

**Screenshot-worthy element:** Color-coded by event severity — blue (info), yellow (warning), red (error/subscription cancelled).

**Splash mapping:** Activity feed shows: "New signup", "First generation", "Pro upgrade", "Export", "Subscription canceled".

---

### 5.3 Real-Time Dashboards

**Reference:** Vercel "Live" metrics, Railway metrics per deployment

**Pattern:** Auto-refresh with stale indicator  
- Last updated timestamp (e.g., "Updated 12s ago")
- If >60s stale, show warning badge

**Splash mapping:** AI generation stats should refresh every 30s during active batches. Show queue depth, success rate, error count.

---

## 6. Funnel Visualization

### 6.1 Product-Led Funnel

**Splash-specific funnel:**
```
Signup → First project → First generation → First export → Subscribe → Pro renewal
```

**Reference:** PostHog Funnels (https://posthog.com/docs/user-guides/insights#funnels)

**Funnel visualization:**
- Horizontal bar chart showing each step's conversion
- Step-to-step drop-off % highlighted
- Time-to-convert shown per step

---

### 6.2 Activation Funnel

**Critical for AI-SaaS:** "First value" moment  
**Splash activation:** First logo generation (not just first project)

**Reference:** PostHog funnels + cohort insights

**Screenshot-worthy element:** The "time to activation" histogram — how long from signup to first generation? Peak should be within 24-48 hours.

---

### 6.3 Funnel Segmentation

**Pattern:** Break down funnel by:  
- Acquisition channel (organic, paid, referral)
- Geographic region
- Device type
- Plan tier

**Splash mapping:** Compare funnel by traffic source — are paid acquisition users converting differently than organic?

---

## 7. Dark-Themed Dashboard References

### 7.1 Dark Mode Design System

**Reference:** Linear dark theme — https://linear.style (70+ community themes)

**Color palette:**
| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
|background|#FFFFFF|#0D0D0D|
|surface|#F8FAFC|#1A1A1A|
|border|#E2E8F0|#2D2D2D|
|text-primary|#0F172A|#FFFFFF|
|text-secondary|#64748B|#9CA3AF|
|accent|#5E6AD2|#5E6AD2|

**Key principle:** Don't just invert — adjust contrast ratios. Dark mode needs lower contrast between surface/background, higher contrast on text/iconography.

---

### 7.2 Tremor Dark Mode

**Reference:** https://tremor.so (Tremor components)

**Tremor's built-in dark mode:**
- Automatic color adjustment via CSS variables
- Works with Tailwind's dark: modifier
- Pre-configured chart colors that work on dark backgrounds

**Screenshot-worthy element:** Tremor's color palette — 8 chart colors pre-selected for dark-background contrast. Drop-in and use.

---

### 7.3 Vercel-Inspired Dark Dashboard

**Reference:** Vercel dashboard + modular SaaS theme (Codester template)

**Elements:**
- Subtle card elevation (box-shadow: 0 1px 3px rgba(0,0,0,0.3))
- Glow effects on charts (area fill with 10% opacity)
- Monospace fonts for numbers

---

## 8. Recharts vs Tremor vs Alternatives

### 8.1 Recharts v3 Capabilities

**Reference:** https://recharts.org (official docs)

**Strengths:**
- Dominant React charting library (2.4M weekly downloads)
- Full TypeScript support
- Composable component model: `<ResponsiveContainer><AreaChart><Area />...</AreaChart></ResponsiveContainer>`
- SVG-based, declarative React API

**Chart types available:**
- Area, Bar, Line, Composed, Pie, Scatter, Radar, RadialBar, Treemap
- Custom shapes, annotations
- Tooltip, Legend, CartesianGrid

**Limitations:**
- No built-in styling — everything manual
- Dark mode requires custom theme configuration
- Learning curve: lots of props to configure
- Partial TypeScript (some `any` types persist)

---

### 8.2 Tremor Capabilities

**Reference:** https://npm.tremor.so / https://tremor.so/components

**Strengths:**
- Built on Recharts — gets Recharts power with pre-styled wrapper
- 20+ open-source components: AreaChart, BarChart, DonutChart, Tracker, BarList
- Tailwind CSS native — uses your design tokens
- Works with shadcn/ui aesthetic out of the box
- Copy-paste components (not a library) — full customization

**Limitations:**
- Requires Tailwind CSS
- Smaller chart type selection than raw Recharts
- No SSR if you depend on client-side hooks
- Bundle: ~45KB gzipped (for chart components)

**Best for:** Production SaaS dashboards fast. "If you want a dashboard in weeks, not months — Tremor."

---

### 8.3 Decision: Can Splash Stay on Recharts?

**Yes — with caveats:**

| Requirement | Recharts | Tremor | Verdict |
|-------------|---------|-------|--------|
| MRR waterfall | ❌ Custom + Recharts ComposedChart | ❌ | Recharts (custom build) |
| Cohort retention curves | ✅ Built-in | ✅ | Tie |
| Dark mode support | ⚠️ Manual | ✅ Built-in | Tremor wins |
| Area/time-series | ✅ Robust | ✅ | Tie |
| Donut/Pie | ✅ Robust | ✅ | Tie |
| Funnel | ⚠️ Manually composed | ⚠️ Manually composed | Tie |
| Activity feed tables | ❌ Not a chart | ❌ | Neither |

**Recommendation:** Use Tremor for standard charts (AreaChart, BarChart, DonutChart) — faster to production. Use raw Recharts for custom visualizations (waterfall, funnel). Keep both — they're compatible (Tremor built on Recharts).

---

## 9. Proposed 12-15 Improvement Ideas for Splash Admin

### Revenue & MRR (Priority: Critical)

1. **Add MRR movement waterfall chart** — Show New / Expansion / Churn breakdown monthly. Built with Recharts ComposedChart. Tracks revenue health at a glance.

2. **Revenue by plan breakdown panel** — Stacked bar chart: Free / Pro / Team. Shows which tier drives revenue. Essential for pricing strategy.

3. **Subscription vs consumption tracking** — Two numbers: MRR (subscriptions) + consumption revenue (credit packs). Track separately but show combined "Total Monthly Revenue" card.

---

### Cost & FinOps (Priority: Critical)

4. **AI cost-per-operation panel** — Track: Gemini API cost / generation (including retries). Show trend vs prior 30 days. Alert if >20% of revenue per user.

5. **Cost-by-service heatmap** — Bar chart: API calls / Storage / Database. Stack within each category shows breakdown. Identify cost spikes quickly.

6. **Gross margin indicator** — Simple calculation: Revenue — AI costs — Infrastructure = Gross Margin. Show as % with target line (70%). Color: green if >70%, yellow if 50-70%, red if <50%.

7. **Burn rate with runway** — Current month cloud spend + projected end-of-month + months of runway at current rate. Simple numeric cards, no chart needed.

---

### User Insights (Priority: High)

8. **Cohort retention curve** — Monthly signup cohorts on X-axis. % retained on Y-axis. Show last 6 cohorts. Track if newer cohorts flatten higher.

9. **User segmentation badges** — Categorize users: "Power User" (10+ gens), "At-Risk" (no session 21 days), "Churned" (cancelled). Show counts for each segment.

10. **Top 10 users table** — Leaderboard sorted by generation count. Shows: email, generation count, total storage used, export count, plan. Identify power users for beta/case studies.

11. **First-to-activation histogram** — Days from signup to first logo generation. Should peak at day 0-2. Shows if onboarding is working.

---

### Funnel & Activation (Priority: High)

12. **Conversion funnel chart** — Signup → First project → First generation → First export → Subscribe. Conversion % shown per step. Identifies drop-off points.

13. **Activation milestone tracker** — "Users who reached first generation within 7 days" — shown as % of signups. Good: >50%. This is the North Star metric for activation.

---

### Activity & Real-Time (Priority: Medium)

14. **Activity feed with event cards** — Real-time-ish feed (refresh every 30s): New signup, First generation, Pro upgrade, Cancel, Export. Icon + timestamp + user + action.

15. **Generation queue status** — For batch operations: In progress, Completed, Failed counts. Shows operational health.

---

## Summary

| Category | Current | Missing | Priority |
|----------|---------|---------|----------|
|MRR/Revenue|No|Yes|P1|
|Cost/FinOps|No|Yes|P1|
|Cohort Retention|No|Yes|P2|
|User Segmentation|No|Yes|P2|
|Funnel|No|Yes|P2|
|Activity Feed|Basic|Yes|P3|

**Recommended stack:**
- UI: Tremor (fastest to production) + Recharts (custom visualizations)
- Data: Prisma queries → cached in Vercel k/v or simple in-memory cache
- Real-time: SSE for activity feeds, polling for charts (60s interval acceptable for admin)

**The biggest gap** — No MRR tracking at all. Add this first. Second — cost visibility. Third — cohort/funnel.