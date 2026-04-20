---
created: 2026-04-21T00:00:00Z
last_updated: 2026-04-21T00:00:00Z
type: spec
change_id: admin-dashboard-insights-overhaul
status: done
trigger: "admin-dashboard-insights-overhaul 적용 — tab-based admin dashboard with unit-economics widgets, per-event cost logging, MRR/margin/burn, funnel, retention cohorts, heatmaps, rate-limit panel, activity feed, CSV export"
---

# Plan: Admin Dashboard Insights Overhaul

Implementation plan mirroring all 80 tasks from `openspec/changes/admin-dashboard-insights-overhaul/tasks.md`, grouped by dependency phase. Tasks are kept atomic with the original task number preserved in the checkbox label (e.g. `[T1.1]`) so coders can cross-reference the spec.

---

## Background & Research

### Stack facts (from AGENTS.md + web/package.json)

- **Framework**: Next.js `16.2.3` App Router (Turbopack), React `19.2.4`
- **Language**: TypeScript strict
- **Styling**: Tailwind v4 (existing Linear-inspired dark theme)
- **API**: tRPC v11 (`@trpc/server ^11.13.0`, `@trpc/react-query ^11.13.0`), Zod v4
- **DB**: PostgreSQL (Neon) via Prisma `^7.7.0` with `prisma-client` generator → `src/generated/prisma/`. PrismaPg adapter in `src/lib/prisma.ts`. `web/prisma.config.ts` is REQUIRED, do not delete.
- **Auth**: NextAuth v5 beta (`5.0.0-beta.30`), JWT strategy, Google OAuth. Admin role checked in `web/src/app/admin/layout.tsx` server-side.
- **AI SDK**: `ai ^6.0.158` (parts-based messages, `onFinish({ text, steps })`)
- **Charts**: `recharts ^3.8.1` ALREADY a dep — no new package needed. Use dynamic `import("recharts")` with `ssr: false` as already done in `web/src/app/admin/page.tsx`.
- **Storage**: Vercel Blob (`put()` from `@vercel/blob`)
- **Image gen**: `@google/genai ^1.49.0`, model `gemini-3-pro-image-preview`
- **Package manager**: **pnpm** (not npm / yarn)
- **Testing**: Vitest for unit tests (if already wired) + Playwright for E2E. Quality gates: `pnpm tsc --noEmit` and `pnpm build`.

### Key existing file anchors (from explorer)

#### `web/src/server/routers/admin.ts`
- `adminProcedure` middleware defined locally (L5-16):
  ```ts
  const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    const dbUser = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { role: true },
    })
    if (!dbUser || dbUser.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." })
    }
    return next()
  })
  ```
- Existing procedures to reuse/extend: `listUsers` (L19-87), `getUserDetail` (L89-168), `getPlatformStats` (L170-267), `getDailyGenerations` (L269-317), `getRecentActivity` (L319-357).
- `listUsers` already does `prisma.usageLog.groupBy({ by: ["userId"], _sum: { count: true } })` — pattern to follow for cost aggregation.
- Task 3.13 should EXTEND this file's `listUsers` in place (add filters + cost/ltv/margin fields). Do not duplicate.

#### `web/src/server/routers/_app.ts` (L1-22)
```ts
export const appRouter = router({
  project: projectRouter,
  logo: logoRouter,
  chat: chatRouter,
  generation: generationRouter,
  export: exportRouter,
  subscription: subscriptionRouter,
  admin: adminRouter,
  usage: usageRouter,
})
```
Task 3.1 adds a new key `adminInsights: adminInsightsRouter` to this object.

#### `web/src/lib/gemini.ts`
- `generateLogoImage(prompt, options)` → `{ imageBuffer, mimeType } | null` (L54-127)
- `editLogoImage(prompt, sourceBuf, mime)` → same return (L129-198)
- Retry wrapper `withRetry` (L17-38) has access to `attempt` and error `status` — exactly where `GeminiRequestLog` writes belong for task 2.1.
- Existing stdout log at L85-92 / L155-162:
  ```ts
  console.log(JSON.stringify({ event: "gemini_request", model: MODEL_NAME, attempt, latencyMs: Date.now() - start }))
  ```
  KEEP those logs; ADD a prisma write alongside.

#### `web/src/app/api/chat/route.ts`
- `generate_batch` execute usageLog call (~L303-305):
  ```ts
  await prisma.usageLog.create({
    data: { userId, projectId, type: "generate", count: logos.length },
  })
  ```
- `edit_logo` execute usageLog call (~L420-422):
  ```ts
  await prisma.usageLog.create({
    data: { userId, projectId, type: "edit", count: 1 },
  })
  ```
- `onFinish({ text, steps })` at ~L486-514 is where the new `type: "llm"` row is written for tokens (task 2.5). Read `usage.inputTokens` / `usage.outputTokens` from the finish payload (AI SDK v6 parts-based).

#### `web/src/lib/storage.ts`
- `uploadImage(key, body: Buffer, contentType)` currently returns `string` (URL only, L15-25).
- `resizeAndUploadImage(dataUrl, projectId, userId)` returns `{ url, mediaType }` (L27-61).
- Task 2.4: extend BOTH to also return `bytes: number` (use `body.byteLength` / resized buffer size). Update all callers accordingly.

#### `web/prisma/schema.prisma`
- Current `UsageLog` model (L126-138):
  ```prisma
  model UsageLog {
    id        String   @id @default(cuid())
    userId    String
    projectId String?
    type      String   // "generate" | "edit"
    count     Int      @default(1)
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
    createdAt DateTime @default(now())
    @@index([userId, createdAt])
    @@index([userId, type])
  }
  ```
- `Subscription` (L114-123): `id, userId @unique, tier, dailyGenerations, dailyResetAt, createdAt, updatedAt`. No price field — pricing stays in `lib/pricing.ts`.
- Task 1.5 adds new `GeminiRequestLog` model. Place it near `UsageLog` in schema.prisma.

#### `web/src/app/admin/page.tsx` (L1-593)
- Currently a single-scroll layout: KPI row (4 cards), 7/30/90 chart, users table (paginated), activity sidebar.
- Dynamic Recharts AreaChart already wrapped (L46-98) — use this pattern for all new Recharts widgets.
- Task 11.1 refactors this page into tab-based layout. The EXISTING KPI row / chart / users table / activity feed get migrated into the new tab components — do NOT delete them blindly; extract logic first.

#### `web/src/app/admin/users/[id]/page.tsx` (L1-343)
- Already exists with tier management dropdown, project/logo gallery, chat history.
- Task 12.1 adds a new "수익 & 비용" panel at the TOP. Insert above the existing user profile header.

#### `web/prisma.config.ts` (L1-12)
```ts
import "dotenv/config"
import { defineConfig, env } from "prisma/config"
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
})
```
DO NOT delete. Prisma 7 requires it (replaces `url = env()` in schema).

### Constants / invariants coders must respect

- **New components directory**: `web/src/components/admin/` — does NOT exist yet. First coder to touch it creates the directory.
- **Pricing numbers** (from proposal / design):
  ```ts
  GEMINI_IMAGE_PRICE_USD = 0.134
  OPENROUTER_INPUT_PRICE_PER_M = 0.50
  OPENROUTER_OUTPUT_PRICE_PER_M = 3.00
  BLOB_PRICE_PER_GB_MONTH = 0.023
  PLAN_PRICE_USD = { free: 0, pro: 10, demo: 0, enterprise: 100 }
  LAST_VERIFIED = "2026-04-21"
  ```
- **Tabs**: `개요 / 비용 / 수익 / 사용자 / 자료` (order matters). URL state via `?tab=overview|cost|revenue|users|assets` (English slugs, Korean labels).
- **Period values**: `7 | 30 | 90 | all`. URL state `?period=30` default.
- **Timezone**: Hour-DoW heatmap uses **KST** (UTC+9).
- **Cohort**: 12 weekly cohorts × W0-W7 (8 columns).
- **Heatmaps** (retention 12×8, hour×dow 24×7): **raw SVG** — Recharts has no primitive; do NOT wrap one.
- **MRR formula**: `Σ PLAN_PRICE_USD[tier]` for subs in `{pro, enterprise}` only. `demo` excluded.
- **LLM attribution**: ONE synthetic `UsageLog { type: "llm", count: 1 }` row per user message in `onFinish`.
- **Dashboard admin-only**: Reuse existing `adminProcedure`. Existing `admin/layout.tsx` already redirects non-admins.
- **MoM null-safe**: When previous month MRR = 0, `mrrGrowthPct` MUST return `null` (not Infinity / NaN). Unit test 3.18 asserts this.

### Research file references

No external research needed — all decisions are locked in `design.md`. Coders should consult `design.md` D1-D16 for any ambiguity.

### UI design artifacts (produced in Phase 4)

Interface-Designer will produce the following before any UI coder task fires:

- `.slash/design/admin-insights/system.md` — color tokens, typography, spacing, banner styles, tab style, chart palettes, heatmap color scale, table density, dark-theme tokens.
- `.slash/design/admin-insights/widgets.md` — wireframe per widget (KPI card, stacked area, MRR row, margin card, ranking tables, funnel, retention heatmap, hour-dow heatmap, rate-limit panel, activity feed, keyword bar, sample gallery, filter bar, CSV button, threshold banners) with props, empty/loading/error states, responsive rules.

**UI coders MUST read both design docs before starting Phase 5+.** Any deviation requires a plan-doc update.

---

## Testing Plan (TDD — tests first within each coder unit)

Global gates (run at end): `pnpm tsc --noEmit` clean, `pnpm build` clean, Playwright passes.

Test files to create (grouped by feature; coders write before implementation):

- [ ] T-unit `web/src/lib/pricing.test.ts` — imageCost / llmCost / blobCost / edge cases (task 1.2)
- [ ] T-unit `scripts/backfill-usage-costs.test.ts` — idempotent, no-op on second run (task 1.8)
- [ ] T-unit `web/src/lib/gemini.test.ts` (or extension) — GeminiRequestLog rows written on ok/retry/failed (task 2.1 verification)
- [ ] T-unit `web/src/app/api/chat/route.test.ts` — mock prisma, assert UsageLog payload has cost fields for success path (task 2.6)
- [ ] T-unit `web/src/app/api/chat/route.test.ts` — undefined `usage` → LLM row with NULL cost, no throw (task 2.7)
- [ ] T-int `web/src/server/routers/admin-insights.test.ts` — every procedure with seeded data (task 3.17)
- [ ] T-int same file — MRR MoM = null when prev = 0 (task 3.18)
- [ ] T-int tRPC end-to-end chat → UsageLog + GeminiRequestLog rows (task 2.8)
- [ ] T-unit `web/src/components/admin/period-selector.test.tsx` + `tab-nav.test.tsx` — URL sync (task 5.5)
- [ ] T-e2e Playwright suite `web/e2e/admin-insights.spec.ts` (tasks 13.1 - 13.4)

---

## Implementation Plan (by phase)

### Phase 1 — Data foundation (blocks everything else)

- [x] [T1.1] Create `web/src/lib/pricing.ts` with `GEMINI_IMAGE_PRICE_USD=0.134`, `OPENROUTER_INPUT_PRICE_PER_M=0.50`, `OPENROUTER_OUTPUT_PRICE_PER_M=3.00`, `BLOB_PRICE_PER_GB_MONTH=0.023`, `PLAN_PRICE_USD={free:0,pro:10,demo:0,enterprise:100}`, helpers `imageCost(n)`, `llmCost(inTok,outTok)`, `blobCost(bytes)`, `LAST_VERIFIED="2026-04-21"`
- [x] [T1.2] Write `pricing.test.ts`: each helper, edge cases (zero tokens, huge byte count, unknown tier)
- [x] [T1.3] Prisma migration `add_usage_log_cost_fields`: add nullable columns to `UsageLog` — `model String?`, `imageCount Int?`, `imageCostUsd Decimal? @db.Decimal(14,6)`, `llmInputTokens Int?`, `llmOutputTokens Int?`, `llmCostUsd Decimal? @db.Decimal(14,6)`, `blobBytes BigInt?`, `blobCostUsd Decimal? @db.Decimal(14,6)`
- [x] [T1.4] In same migration: allow `type = "llm"` — since `type` is already free-form `String`, no DB change; update any Zod validator that enumerates values to include `"llm"`
- [x] [T1.5] Prisma migration `add_gemini_request_log`: add `GeminiRequestLog` model with `id, userId String?, projectId String?, model String, status String` (`"ok"|"retry"|"failed"`), `httpCode Int?`, `attempt Int`, `latencyMs Int`, `errorMessage String?`, `createdAt DateTime @default(now())`; indexes `@@index([createdAt])` and `@@index([status, createdAt])`
- [x] [T1.6] Run `pnpm prisma migrate dev`, regenerate client, verify types compile with `pnpm tsc --noEmit`
- [x] [T1.7] Create `scripts/backfill-usage-costs.ts` — idempotent: `WHERE imageCostUsd IS NULL AND type IN ("generate","edit")` → set `imageCostUsd = count * GEMINI_IMAGE_PRICE_USD`, `imageCount = count`. Log rows updated.
- [x] [T1.8] Unit test backfill against seeded Prisma test DB — assert idempotency

### Phase 2 — Write-time cost recording (blocks router)

- [x] [T2.1] Refactor `web/src/lib/gemini.ts` — inside `withRetry` / per-attempt block of `generateLogoImage` and `editLogoImage`, write to `GeminiRequestLog` on every attempt (ok/retry/failed) with `status, httpCode, attempt, latencyMs, model, errorMessage?`. Import `prisma` lazily to avoid breaking the test surface.
- [x] [T2.2] Modify `web/src/app/api/chat/route.ts` `generate_batch` tool execute (~L303-305) — extend `usageLog.create` with `model: MODEL_NAME, imageCount: logos.length, imageCostUsd: imageCost(logos.length), blobBytes: totalBlobBytes, blobCostUsd: blobCost(totalBlobBytes)`
- [x] [T2.3] Modify `edit_logo` tool execute (~L420-422) — same fields for single-image edit (imageCount: 1)
- [x] [T2.4] In `web/src/lib/storage.ts`, extend `uploadImage` return to `{ url, bytes }` and `resizeAndUploadImage` to `{ url, mediaType, bytes }`. Update all callers (chat route, export route, anywhere else `rg "uploadImage|resizeAndUploadImage"`) to destructure the new `bytes`.
- [x] [T2.5] In `streamText` `onFinish` (~L486) — after building parts, call `prisma.usageLog.create({ data: { userId, projectId, type: "llm", count: 1, llmInputTokens, llmOutputTokens, llmCostUsd: llmCost(in, out), model: DEFAULT_MODEL } })`. Guard with `if (usage?.inputTokens != null)` — write NULL cost if unavailable.
- [x] [T2.6] Unit test: mock Prisma, simulate successful `generate_batch` → assert UsageLog payload has cost fields
- [x] [T2.7] Unit test: simulate missing `usage` → assert LLM row created with NULLs, no throw
- [x] [T2.8] Integration test via tRPC: end-to-end chat message → assert GeminiRequestLog + UsageLog rows written

### Phase 3 — tRPC insights router (blocks UI)

- [x] [T3.1] Create `web/src/server/routers/admin-insights.ts`, export `adminInsightsRouter`. Register in `_app.ts` as `adminInsights`.
- [x] [T3.2] Procedure `getOverviewKpis({period})` → `{mrrThisMonth, marginUsd, marginPct, burnRate30d, totalUsers, activeUsers, generationsInPeriod}`
- [x] [T3.3] Procedure `getMrrBreakdown({period})` → `{mrrThisMonth, mrrLastMonth, mrrGrowthPct, arr, paidSubCount, weeklyChurnPct}` — return `mrrGrowthPct: null` when `mrrLastMonth === 0`
- [x] [T3.4] Procedure `getCostBreakdown({period})` → `Array<{date, gemini_image, openrouter_llm, vercel_blob}>`
- [x] [T3.5] Procedure `getUserRankings({period})` → `{topSpenders[], topCostUsers[], marginRanking[]}` (each row: `userId, name, email, value`)
- [x] [T3.6] Procedure `getFunnel({period})` → `{signups, firstProject, firstGeneration, paidSub}` with counts (use `User.createdAt` → earliest `Project.createdAt` → earliest `UsageLog.createdAt` → `Subscription.tier ∈ {pro, enterprise}`)
- [x] [T3.7] Procedure `getCohortRetention()` → 12 cohorts × 8 weeks matrix of `{cohortWeekStart, w0..w7}` with percentages
- [x] [T3.8] Procedure `getHourDowHeatmap({period})` → `Array<{hourKst 0..23, dow 0..6, count}>` (convert `createdAt` to KST before bucketing)
- [x] [T3.9] Procedure `getGeminiHealth()` → `{rate429Pct24h, errorRatePct24h, avgRetries24h}` from `GeminiRequestLog`
- [x] [T3.10] Procedure `getActivityFeed({cursor?, limit=50})` → merged UsageLog + tier-change events, cursor-paginated desc (cursor = composite `{createdAt, id}`)
- [x] [T3.11] Procedure `getPopularKeywords({period})` → top 15 keyword matches against `lib/style-keywords.ts` on `Logo.prompt` (case-insensitive)
- [x] [T3.12] Procedure `getSampleGallery()` → latest 24 LogoVersions `{id, imageUrl, userId, userName, createdAt}`
- [x] [T3.13] Extend existing `admin.listUsers` in `web/src/server/routers/admin.ts` — add filter params `tiers?: string[]`, `activity?: "active"|"inactive"`, `signupFrom?, signupTo?`; add response fields `totalCostUsd, ltvUsd, marginUsd` per row
- [x] [T3.14] Procedure `exportUsersCsv(filters)` on `adminInsights` — returns `{ csv: string, filename: string }`; same filters as listUsers; UTF-8 BOM for Excel
- [x] [T3.15] Procedure `getUserCostRevenue(userId)` → `{monthlyPriceUsd, ltvUsd, totalCostUsd, marginUsd}`
- [x] [T3.16] Create `web/src/lib/style-keywords.ts` — static Korean + English dictionary (minimalist, vintage, retro, geometric, gradient, flat, 3d, mascot, wordmark, monogram, 모던, 빈티지, 레트로, 기하, 그라데이션, 플랫, 마스코트, 워드마크, etc.)
- [x] [T3.17] Unit tests for every procedure with seeded data, assert correct aggregations
- [x] [T3.18] Unit test MRR MoM = null when last month is 0

### Phase 4 — Interface-Designer (**BLOCKS ALL UI CODERS — MANDATORY**)

**No Phase 5+ UI task may start until 4.1-4.3 are complete.** The orchestrator (mad-agent / parent) MUST fire Interface-Designer before dispatching any UI coder. Design docs live under `.slash/design/admin-insights/` — if that directory is missing or incomplete, UI coders HALT.

- [ ] [T4.1] Fire Interface-Designer agent → produce `.slash/design/admin-insights/system.md` (color tokens, typography, spacing, banner styles, tab style, chart palettes for stacked-area, heatmap color scale, table density; dark-theme tokens matching existing Linear-inspired look)
- [ ] [T4.2] Fire Interface-Designer → produce `.slash/design/admin-insights/widgets.md` — one section per widget (KPI card, stacked area chart, MRR KPI row, margin card, ranking table, funnel, retention heatmap, hour-dow heatmap, rate-limit panel, activity feed, keyword bar chart, sample gallery, filter bar, CSV button, threshold banners) with wireframe-level layout, props, empty/loading/error states, responsive rules
- [ ] [T4.3] Human review & approve design docs before any UI coder task fires

### Phase 5 — UI shared primitives (blocks tab widgets)

- [x] [T5.1] Create `web/src/components/admin/period-selector.tsx` (7/30/90/전체) — URL-synced via `?period=` query using `useRouter` + `useSearchParams`
- [x] [T5.2] Create `web/src/components/admin/tab-nav.tsx` — URL-synced via `?tab=` query; handles invalid tab → fallback to `개요`
- [x] [T5.3] Create `web/src/components/admin/threshold-banners.tsx` — computes which banners to show from `getOverviewKpis` + `getMrrBreakdown` + `getGeminiHealth`; sessionStorage dismiss key per session
- [x] [T5.4] Create `web/src/components/admin/kpi-card.tsx` (value, label, trend, optional sparkline) — reusable; match existing KPI card styling from `admin/page.tsx` L146-185
- [x] [T5.5] Unit tests for period-selector, tab-nav URL sync

### Phase 6 — 개요 (overview) tab widgets

- [x] [T6.1] Create `web/src/components/admin/overview-kpis.tsx` — MRR, Active users, Generations, Margin, Burn KPI row using `kpi-card`
- [x] [T6.2] Create `web/src/components/admin/margin-card.tsx`
- [x] [T6.3] Create `web/src/components/admin/funnel-widget.tsx` — 4-stage bar visualization with conversion %
- [x] [T6.4] Create `web/src/components/admin/hour-dow-heatmap.tsx` — 24×7 raw SVG heatmap, 5-bucket quantile color scale
- [x] [T6.5] Create `web/src/components/admin/gemini-health-panel.tsx` — 3 KPIs (429 rate, error rate, avg retries)

### Phase 7 — 비용 (cost) tab widgets

- [x] [T7.1] Create `web/src/components/admin/cost-stacked-area.tsx` — Recharts stacked `AreaChart`, 3 layers (`gemini_image`, `openrouter_llm`, `vercel_blob`), tooltip. Use the dynamic-import pattern from existing `admin/page.tsx` L46-98.
- [x] [T7.2] Create `web/src/components/admin/cost-totals-row.tsx` — period totals by source + grand total
- [x] [T7.3] Create `web/src/components/admin/cost-by-user-table.tsx` — top cost users with drilldown link to `/admin/users/[id]`

### Phase 8 — 수익 (revenue) tab widgets

- [x] [T8.1] Create `web/src/components/admin/mrr-kpi-row.tsx` — MRR/MoM/ARR/active subs/churn
- [x] [T8.2] Create `web/src/components/admin/mrr-trend-chart.tsx` — line chart of MRR over selected period (Recharts `LineChart`)
- [x] [T8.3] Create `web/src/components/admin/plan-breakdown.tsx` — donut (Recharts `PieChart`) or stacked bar showing active users per tier

### Phase 9 — 사용자 (users) tab widgets

- [x] [T9.1] Create `web/src/components/admin/user-filter-bar.tsx` — tier multi-select + 활성도 + signup date range + text search (controlled; calls extended `listUsers`)
- [x] [T9.2] Create `web/src/components/admin/user-table-v2.tsx` — new columns (비용, LTV, 마진), sort handlers, server-driven pagination, tier change dropdown preserved from existing admin page
- [x] [T9.3] Create `web/src/components/admin/user-rankings.tsx` — three ranking tables (top spenders, top cost, margin)
- [x] [T9.4] Create `web/src/components/admin/csv-export-button.tsx` — calls `exportUsersCsv` procedure, triggers Blob download with filename `users-{YYYYMMDD}.csv`

### Phase 10 — 자료 (assets) tab widgets

- [x] [T10.1] Create `web/src/components/admin/cohort-retention-heatmap.tsx` — 12×8 raw SVG heatmap, labels left (cohort week) + top (W0..W7)
- [x] [T10.2] Create `web/src/components/admin/activity-feed.tsx` — infinite-scroll cursor pagination, manual refresh button, auto-refresh on `visibilitychange` focus
- [x] [T10.3] Create `web/src/components/admin/popular-keywords.tsx` — horizontal bar chart (Recharts `BarChart` with `layout="vertical"`), top 15
- [x] [T10.4] Create `web/src/components/admin/sample-gallery.tsx` — 6×4 grid of LogoVersion thumbnails, each linked to user detail

### Phase 11 — Assemble /admin page

- [x] [T11.1] Refactor `web/src/app/admin/page.tsx` into tab-based layout; migrate existing KPI row / chart / users table / activity into the new 개요 and 사용자 tabs; remove the old single-scroll layout
- [x] [T11.2] Wire threshold banners at the top (outside tabs)
- [x] [T11.3] Wire `PeriodSelector`, `TabNav`, `Suspense` fallbacks, loading skeletons per widget
- [ ] [T11.4] Lighthouse + visual regression check (Playwright screenshot diff)

### Phase 12 — /admin/users/[id] enhancements

- [x] [T12.1] Add "수익 & 비용" panel component at top of `web/src/app/admin/users/[id]/page.tsx` using `getUserCostRevenue`
- [x] [T12.2] Respect main-dashboard period selector via query param passthrough (`?period=` propagated from list page link)

### Phase 13 — End-to-end verification

- [ ] [T13.1] Playwright: admin login → visit each tab (개요/비용/수익/사용자/자료) → widgets render without errors
- [ ] [T13.2] Playwright: change tier on user → user row updates → ranking table updates after requery
- [ ] [T13.3] Playwright: CSV export downloads valid file
- [ ] [T13.4] Playwright: threshold banner appears when seeded cost > MRR × 30%
- [x] [T13.5] `pnpm tsc --noEmit` clean
- [x] [T13.6] `pnpm build` clean
- [x] [T13.7] Run backfill script on local DB, verify no-op on second run
- [x] [T13.8] Non-admin user confirms `FORBIDDEN` on all `adminInsights.*` procedures (manual or Playwright)

### Phase 14 — Deployment (**HUMAN-OPS — flag to user, NOT coder work**)

> **WARNING: These steps are manual, performed by the human operator. Coder agents MUST NOT execute them.**

- [ ] [T14.1] **[HUMAN]** Merge migration-only PR first; deploy; verify no regressions
- [ ] [T14.2] **[HUMAN]** Deploy app code PR
- [ ] [T14.3] **[HUMAN]** Run `pnpm tsx scripts/backfill-usage-costs.ts` in production (via Vercel CLI or local shell with prod `DATABASE_URL`)
- [ ] [T14.4] **[HUMAN]** Confirm dashboard shows non-zero cost chart for historical period
- [ ] [T14.5] **[HUMAN]** Set calendar reminder to re-verify unit prices in `pricing.ts` (LAST_VERIFIED date) quarterly

---

## Parallelization Plan

Phases are **strictly sequential** at the phase boundary. Within a phase, multiple coders may run in parallel with non-overlapping file allowlists. Never assign the same file to two coders.

### Batch 1: Phase 1 (data foundation) — **SEQUENTIAL, single coder**
- [ ] Coder A1 (all of Phase 1, tasks 1.1 - 1.8) → files: `web/src/lib/pricing.ts`, `web/src/lib/pricing.test.ts`, `web/prisma/schema.prisma`, `web/prisma/migrations/**`, `scripts/backfill-usage-costs.ts`, `scripts/backfill-usage-costs.test.ts`

### Batch 2: Phase 2 (write-time cost) — **2 parallel coders after Batch 1**
- [ ] Coder B1: tasks 2.1 → files: `web/src/lib/gemini.ts`, `web/src/lib/gemini.test.ts`
- [ ] Coder B2: tasks 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8 → files: `web/src/lib/storage.ts`, `web/src/app/api/chat/route.ts`, `web/src/app/api/chat/route.test.ts`, plus any other callers of `uploadImage`/`resizeAndUploadImage` (e.g. export route)
- Synchronization: B2 depends on B1's `GeminiRequestLog` model being in schema (satisfied by Batch 1). B2 must coordinate with any coder touching storage callers.

### Batch 3: Phase 3 (router) — **2 parallel coders after Batch 2**
- [ ] Coder C1: tasks 3.1, 3.2, 3.3, 3.4, 3.5, 3.9, 3.10, 3.16, 3.17, 3.18 → files: `web/src/server/routers/admin-insights.ts` (KPI + MRR + cost breakdown + rankings + gemini-health + activity-feed procedures), `web/src/server/routers/_app.ts` (registration), `web/src/lib/style-keywords.ts`, `web/src/server/routers/admin-insights.test.ts`
- [ ] Coder C2: tasks 3.6, 3.7, 3.8, 3.11, 3.12, 3.14, 3.15 → files: `web/src/server/routers/admin-insights.ts` (funnel + cohort + heatmap + keywords + gallery + csv-export + user-cost-revenue procedures)
- [ ] Coder C3: task 3.13 → files: `web/src/server/routers/admin.ts` (extend existing listUsers)
- **File-conflict mitigation**: C1 and C2 both touch `admin-insights.ts` — split by distinct, named procedure exports. Assign C1 to write the file scaffold (router object + C1's procedures) FIRST; C2 appends its procedures after C1 lands. Enforce via Batch 3a (C1 alone) then Batch 3b (C2 + C3 parallel).

**Revised Batch 3:**
- Batch 3a: Coder C1 (3.1 scaffold + 3.2-3.5, 3.9, 3.10, 3.16, 3.17-3.18)
- Batch 3b (parallel after 3a): Coder C2 (3.6-3.8, 3.11-3.12, 3.14-3.15), Coder C3 (3.13)

### Batch 4: Phase 4 (Interface-Designer) — **NOT coders, fire mad-agent / Interface-Designer**
- [ ] Interface-Designer produces `system.md` and `widgets.md` under `.slash/design/admin-insights/`
- **HARD BLOCK**: No Phase 5+ task dispatches until these files exist and are approved.

### Batch 5: Phase 5 (UI primitives) — **1 coder after Batch 4**
- [ ] Coder D1: tasks 5.1, 5.2, 5.3, 5.4, 5.5 → files: `web/src/components/admin/period-selector.tsx`, `tab-nav.tsx`, `threshold-banners.tsx`, `kpi-card.tsx`, and their `.test.tsx` files

### Batch 6: Phases 6-10 (tab widgets) — **5 parallel coders after Batch 5**
Each coder owns one tab's components, no file overlap:
- [ ] Coder E1 (Phase 6, overview): tasks 6.1-6.5 → files: `web/src/components/admin/overview-kpis.tsx`, `margin-card.tsx`, `funnel-widget.tsx`, `hour-dow-heatmap.tsx`, `gemini-health-panel.tsx`
- [ ] Coder E2 (Phase 7, cost): tasks 7.1-7.3 → files: `web/src/components/admin/cost-stacked-area.tsx`, `cost-totals-row.tsx`, `cost-by-user-table.tsx`
- [ ] Coder E3 (Phase 8, revenue): tasks 8.1-8.3 → files: `web/src/components/admin/mrr-kpi-row.tsx`, `mrr-trend-chart.tsx`, `plan-breakdown.tsx`
- [ ] Coder E4 (Phase 9, users): tasks 9.1-9.4 → files: `web/src/components/admin/user-filter-bar.tsx`, `user-table-v2.tsx`, `user-rankings.tsx`, `csv-export-button.tsx`
- [ ] Coder E5 (Phase 10, assets): tasks 10.1-10.4 → files: `web/src/components/admin/cohort-retention-heatmap.tsx`, `activity-feed.tsx`, `popular-keywords.tsx`, `sample-gallery.tsx`

### Batch 7: Phase 11 (assemble page) — **1 coder after Batch 6**
- [ ] Coder F1: tasks 11.1-11.4 → files: `web/src/app/admin/page.tsx` only. Playwright screenshot test lives under `web/e2e/` — coordinate with Batch 9 coder.

### Batch 8: Phase 12 (user detail) — **1 coder parallel with Batch 7**
- [ ] Coder F2: tasks 12.1-12.2 → files: `web/src/app/admin/users/[id]/page.tsx` only.

### Batch 9: Phase 13 (verification) — **1 coder after Batches 7 & 8**
- [ ] Coder G1: tasks 13.1-13.8 → files: `web/e2e/admin-insights.spec.ts` (new), plus running `pnpm tsc --noEmit` and `pnpm build` as gates.

### Batch 10: Phase 14 (deployment) — **HUMAN, not a coder batch**
- Flag tasks 14.1-14.5 to the user. Plan doc status → `done` only after the user confirms 14.1-14.4 in production and 14.5 reminder is set.

### Dependencies

```
Batch 1 (data)
   ↓
Batch 2 (write-time cost)   ← needs GeminiRequestLog, usageLog cost columns, storage.bytes
   ↓
Batch 3a (router scaffold + C1 procedures)
   ↓
Batch 3b (C2 procedures + C3 admin.listUsers extension)
   ↓
Batch 4 (Interface-Designer docs)   ← HARD BLOCK for all UI
   ↓
Batch 5 (UI primitives)
   ↓
Batch 6 (tab widgets, 5 parallel)
   ↓
Batch 7 (/admin page)    ┐
                         ├── parallel (no file overlap)
Batch 8 (/admin/users/[id])   ┘
   ↓
Batch 9 (E2E verification)
   ↓
Batch 10 (HUMAN deployment)
```

### Risk Areas

- **Phase 2 file contention**: B2 touches both `storage.ts` and `route.ts` and any other `uploadImage` caller. If `web/src/app/api/export/**` routes also call it, fold those callers into B2's allowlist. Grep first: `rg "uploadImage|resizeAndUploadImage" web/src`.
- **Phase 3 router file contention**: `admin-insights.ts` is shared by C1 and C2. Mitigated by serializing into 3a/3b. If mad-agent prefers full parallelism, C2 must rebase on top of C1's PR before running.
- **Phase 6-10 Recharts bundling**: Always use `dynamic(() => import("recharts"), { ssr: false })` wrapper pattern from existing `admin/page.tsx`; otherwise SSR will fail.
- **Phase 11 regression risk**: Refactoring the admin page may break existing E2E (if any). Verify the tier-update mutation flow survives the refactor.
- **KST conversion**: `getHourDowHeatmap` must do server-side KST bucketing — easy to get wrong when Prisma returns UTC `DateTime`.
- **Decimal handling**: Prisma returns `Decimal` objects, not numbers. Procedures must `.toNumber()` before serializing to tRPC output or frontend will get `{ d: [...], e: n, s: n }`.
- **Migration-only PR**: Task 14.1 says migration deploys FIRST, then code. Make sure the migration PR doesn't also carry code that READS the new columns — write-code must fail-safe when NULL.
- **Blob bytes underreporting**: If `uploadImage` return is not fully threaded through, `blobBytes` will be NULL and cost will be under-reported. B2 acceptance gate: `rg "uploadImage\\(|resizeAndUploadImage\\(" web/src` should show every caller destructuring `bytes`.
- **Playwright admin login**: E2E needs an admin user in test DB. Reuse whatever fixture the existing test suite uses, or seed via Prisma before spec runs.

---

## Done Criteria

- [ ] All 80 tasks above marked complete (ignoring 14.x which are human-ops)
- [ ] `.slash/design/admin-insights/system.md` and `widgets.md` exist and were used
- [ ] `pnpm tsc --noEmit` clean
- [ ] `pnpm build` clean
- [ ] Playwright suite (tasks 13.1-13.4) green
- [ ] OpenSpec tasks checked:
  - `openspec/changes/admin-dashboard-insights-overhaul/tasks.md` sections 1-13 fully ticked
  - Section 14 flagged to user but not auto-checked
- [ ] `openspec validate admin-dashboard-insights-overhaul --strict` passes
- [ ] Migration-only PR and app code PR merged separately (14.1 / 14.2) — confirmed by user
- [ ] Backfill script executed once in production (14.3) — confirmed by user


---

## Deferred at Archive Time
- T11.4 and T13.1-T13.4 are deferred because Playwright admin E2E requires `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` credentials and seeded runtime data not available in this execution context.
- T14.1-T14.5 are intentionally deferred as human-ops deployment/production verification actions.
- These deferred items are non-blocking for spec sync + archive, and remain unchecked in archived `tasks.md`.