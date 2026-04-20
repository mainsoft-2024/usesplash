## 1. Foundation — pricing, schema, backfill

- [x] 1.1 Create `web/src/lib/pricing.ts` with `GEMINI_IMAGE_PRICE_USD=0.134`, `OPENROUTER_INPUT_PRICE_PER_M=0.50`, `OPENROUTER_OUTPUT_PRICE_PER_M=3.00`, `BLOB_PRICE_PER_GB_MONTH=0.023`, `PLAN_PRICE_USD={free:0,pro:10,demo:0,enterprise:100}`, helpers `imageCost(n)`, `llmCost(inTok,outTok)`, `blobCost(bytes)`, `LAST_VERIFIED` date constant
- [x] 1.2 Unit test `pricing.test.ts`: each helper, edge cases (zero tokens, huge byte count, unknown tier)
- [x] 1.3 Prisma migration: add nullable columns to `UsageLog` — `model String?`, `imageCount Int?`, `imageCostUsd Decimal? @db.Decimal(14,6)`, `llmInputTokens Int?`, `llmOutputTokens Int?`, `llmCostUsd Decimal? @db.Decimal(14,6)`, `blobBytes BigInt?`, `blobCostUsd Decimal? @db.Decimal(14,6)`
- [x] 1.4 Prisma migration: extend `UsageLog.type` to allow `"llm"` (string field today — update validator/zod, no DB enum change needed)
- [x] 1.5 Prisma migration: add `GeminiRequestLog` model with `id, userId?, projectId?, model, status ("ok"|"retry"|"failed"), httpCode Int?, attempt Int, latencyMs Int, errorMessage String?, createdAt`, index `[createdAt]`, index `[status, createdAt]`
- [x] 1.6 `pnpm prisma migrate dev` locally, regenerate client, verify types compile
- [x] 1.7 Create `scripts/backfill-usage-costs.ts` — idempotent: `WHERE imageCostUsd IS NULL AND type IN ("generate","edit")` → set `imageCostUsd = count * GEMINI_IMAGE_PRICE_USD`, `imageCount = count`. Log rows updated.
- [x] 1.8 Unit test backfill script against a seeded SQLite/Prisma test DB

## 2. Cost recording at write time

- [x] 2.1 Refactor `web/src/lib/gemini.ts` — `generateLogoImage` and `editLogoImage` also write to `GeminiRequestLog` on every attempt (ok/retry/failed) with correct `status, httpCode, attempt, latencyMs`
- [x] 2.2 Modify `web/src/app/api/chat/route.ts` `generate_batch` tool execute (~lines 303-305) — include `model, imageCount, imageCostUsd, blobBytes, blobCostUsd` in `usageLog.create`
- [x] 2.3 Modify `edit_logo` tool execute (~lines 420-422) — same fields for single-image edit
- [x] 2.4 Capture `blobBytes` from the `uploadImage` call return (inspect response / Buffer length). If current `uploadImage` doesn't expose size, extend its return to include `bytes`.
- [x] 2.5 In `streamText` `onFinish` (~line 486) — read `usage.inputTokens/outputTokens`, write `usageLog.create({ type:"llm", count:1, llmInputTokens, llmOutputTokens, llmCostUsd, model: DEFAULT_MODEL })`. Handle undefined usage safely.
- [x] 2.6 Unit test: mock Prisma, simulate successful generate → assert UsageLog payload has cost fields
- [x] 2.7 Unit test: simulate missing `usage` → assert LLM row created with NULLs, no throw
- [x] 2.8 Integration test via tRPC: end-to-end chat message → assert GeminiRequestLog + UsageLog rows written

## 3. tRPC procedures — insights router

- [x] 3.1 Create `web/src/server/routers/admin-insights.ts`, export `adminInsightsRouter`. Register in `_app.ts` as `adminInsights`.
- [x] 3.2 Procedure `getOverviewKpis({period})` → `{mrrThisMonth, marginUsd, marginPct, burnRate30d, totalUsers, activeUsers, generationsInPeriod}`
- [x] 3.3 Procedure `getMrrBreakdown({period})` → `{mrrThisMonth, mrrLastMonth, mrrGrowthPct, arr, paidSubCount, weeklyChurnPct}`
- [x] 3.4 Procedure `getCostBreakdown({period})` → `Array<{date, gemini_image, openrouter_llm, vercel_blob}>`
- [x] 3.5 Procedure `getUserRankings({period})` → `{topSpenders[], topCostUsers[], marginRanking[]}` (each row: `userId, name, email, value`)
- [x] 3.6 Procedure `getFunnel({period})` → `{signups, firstProject, firstGeneration, paidSub}` with counts
- [x] 3.7 Procedure `getCohortRetention()` → 12 cohorts × 8 weeks matrix of `{cohortWeekStart, w0..w7}` with percentages
- [x] 3.8 Procedure `getHourDowHeatmap({period})` → `Array<{hourKst 0..23, dow 0..6, count}>`
- [x] 3.9 Procedure `getGeminiHealth()` → `{rate429Pct24h, errorRatePct24h, avgRetries24h}` from GeminiRequestLog
- [x] 3.10 Procedure `getActivityFeed({cursor?, limit=50})` → merged UsageLog + tier-change events, cursor-paginated desc
- [x] 3.11 Procedure `getPopularKeywords({period})` → top 15 keyword matches against `lib/style-keywords.ts`
- [x] 3.12 Procedure `getSampleGallery()` → latest 24 LogoVersions `{id, imageUrl, userId, userName, createdAt}`
- [x] 3.13 Extend existing `admin.listUsers` — add filter params `tiers?: string[]`, `activity?: "active"|"inactive"`, `signupFrom?, signupTo?`; add response fields `totalCostUsd, ltvUsd, marginUsd`
- [x] 3.14 Procedure `exportUsersCsv(filters)` → returns CSV string (let the client save); same filters as listUsers
- [x] 3.15 Procedure `getUserCostRevenue(userId)` → `{monthlyPriceUsd, ltvUsd, totalCostUsd, marginUsd}`
- [x] 3.16 Create `web/src/lib/style-keywords.ts` — static Korean + English dictionary (minimalist, vintage, retro, geometric, gradient, flat, 3d, mascot, wordmark, monogram, 모던, 빈티지, 레트로, 기하, 그라데이션, 플랫, 마스코트, 워드마크, etc.)
- [x] 3.17 Unit test every procedure with seeded data, assert correct aggregations
- [x] 3.18 Unit test MRR MoM = null when last month is 0 (spec scenario)

## 4. UI — Interface-Designer first

- [x] 4.1 Fire Interface-Designer agent to produce `.slash/design/admin-insights/system.md` (color tokens, typography, spacing, banner styles, tab style, chart palettes for stacked-area, heatmap color scale, table density). Include dark-theme tokens matching existing Linear-inspired look.
- [x] 4.2 Fire Interface-Designer to produce `.slash/design/admin-insights/widgets.md` — one section per widget (KPI card, stacked area chart, MRR KPI row, margin card, ranking table, funnel, retention heatmap, hour-dow heatmap, rate-limit panel, activity feed, keyword bar chart, sample gallery, filter bar, CSV button, threshold banners) with wireframe-level layout, props, empty/loading/error states, responsive rules
- [x] 4.3 Review & approve design docs before any UI coder task fires

## 5. UI — shared primitives

- [x] 5.1 Create `web/src/components/admin/period-selector.tsx` (7/30/90/전체) — URL-synced via `?period=` query
- [x] 5.2 Create `web/src/components/admin/tab-nav.tsx` — URL-synced via `?tab=` query; handles invalid tab fallback to `개요`
- [x] 5.3 Create `web/src/components/admin/threshold-banners.tsx` — computes which banners to show, sessionStorage dismiss
- [x] 5.4 Create `web/src/components/admin/kpi-card.tsx` (value, label, trend, optional sparkline) — reusable
- [x] 5.5 Unit test period-selector, tab-nav URL sync

## 6. UI — 개요 tab widgets

- [x] 6.1 Create `web/src/components/admin/overview-kpis.tsx` — MRR, Active users, Generations, Margin, Burn KPI row using `kpi-card`
- [x] 6.2 Create `web/src/components/admin/margin-card.tsx`
- [x] 6.3 Create `web/src/components/admin/funnel-widget.tsx` — 4-stage bar visualization with conversion %
- [x] 6.4 Create `web/src/components/admin/hour-dow-heatmap.tsx` — 24×7 raw SVG heatmap, 5-bucket quantile color scale
- [x] 6.5 Create `web/src/components/admin/gemini-health-panel.tsx` — 3 KPIs

## 7. UI — 비용 tab widgets

- [x] 7.1 Create `web/src/components/admin/cost-stacked-area.tsx` — Recharts stacked `AreaChart`, 3 layers, tooltip
- [x] 7.2 Create `web/src/components/admin/cost-totals-row.tsx` — period totals by source + grand total
- [x] 7.3 Create `web/src/components/admin/cost-by-user-table.tsx` — top cost users with drilldown link

## 8. UI — 수익 tab widgets

- [x] 8.1 Create `web/src/components/admin/mrr-kpi-row.tsx` — MRR/MoM/ARR/active subs/churn
- [x] 8.2 Create `web/src/components/admin/mrr-trend-chart.tsx` — line chart of MRR over selected period (Recharts)
- [x] 8.3 Create `web/src/components/admin/plan-breakdown.tsx` — donut/stacked showing active users per tier

## 9. UI — 사용자 tab widgets

- [x] 9.1 Create `web/src/components/admin/user-filter-bar.tsx` — tier multi-select + 활성도 + signup date range + text search
- [x] 9.2 Create `web/src/components/admin/user-table-v2.tsx` — new columns (비용, LTV, 마진), sort handlers, server-driven pagination, tier change dropdown preserved
- [x] 9.3 Create `web/src/components/admin/user-rankings.tsx` — three ranking tables (top spenders, top cost, margin)
- [x] 9.4 Create `web/src/components/admin/csv-export-button.tsx` — calls `exportUsersCsv` procedure, triggers Blob download with filename `users-{YYYYMMDD}.csv`

## 10. UI — 자료 tab widgets

- [x] 10.1 Create `web/src/components/admin/cohort-retention-heatmap.tsx` — 12×8 raw SVG heatmap, labels left + top
- [x] 10.2 Create `web/src/components/admin/activity-feed.tsx` — infinite-scroll cursor pagination, manual refresh button, auto-refresh on focus
- [x] 10.3 Create `web/src/components/admin/popular-keywords.tsx` — horizontal bar chart (Recharts), top 15
- [x] 10.4 Create `web/src/components/admin/sample-gallery.tsx` — 6×4 grid of LogoVersion thumbnails, each linked to user detail

## 11. UI — assemble /admin page

- [x] 11.1 Refactor `web/src/app/admin/page.tsx` into tab-based layout; move existing KPI row into 개요 tab; delete the current single-chart-and-table layout
- [x] 11.2 Wire threshold banners at the top (outside tabs)
- [x] 11.3 Wire PeriodSelector, TabNav, Suspense fallbacks, loading skeletons per widget
- [ ] 11.4 Lighthouse + visual regression check (Playwright screenshot)

## 12. UI — /admin/users/[id] enhancements

- [x] 12.1 Add "수익 & 비용" panel component at top of detail page using `getUserCostRevenue`
- [x] 12.2 Respect main-dashboard period selector via query param passthrough

## 13. End-to-end verification

- [ ] 13.1 Playwright: admin login → visit each tab → widgets render without errors
- [ ] 13.2 Playwright: change tier on user → user row updates → ranking table updates after requery
- [ ] 13.3 Playwright: CSV export downloads valid file
- [ ] 13.4 Playwright: threshold banner appears when seeded cost > MRR × 30%
- [x] 13.5 `pnpm tsc --noEmit` clean
- [x] 13.6 `pnpm build` clean
- [x] 13.7 Run backfill script on local DB, verify no-op on second run
- [x] 13.8 Non-admin user confirms FORBIDDEN on all `adminInsights.*` procedures

## 14. Deployment

- [ ] 14.1 Merge migration-only PR first; deploy; verify no regressions
- [ ] 14.2 Deploy app code PR
- [ ] 14.3 Run `pnpm tsx scripts/backfill-usage-costs.ts` in production
- [ ] 14.4 Confirm dashboard shows non-zero cost chart for historical period
- [ ] 14.5 Set calendar reminder to re-verify unit prices in `pricing.ts` (LAST_VERIFIED date) quarterly


---

Deferred note:
- T11.4 and T13.1-T13.4 are intentionally left unchecked because Playwright E2E execution requires `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` credentials (and seeded test data) not available in this run.
- T14.1-T14.5 are human-ops deployment tasks and are intentionally left unchecked for manual completion.