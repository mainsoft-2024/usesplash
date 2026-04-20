## Context

Splash is an AI logo SaaS with per-event API costs (Gemini image + OpenRouter LLM) and subscription revenue. Today's admin dashboard (`/admin`) shows aggregate counts but not a single dollar — we cannot answer "Are we profitable?", "Who are our most valuable users?", "Is churn increasing?", "Is our Gemini bill spiking?".

Current state:
- `UsageLog` records every `generate` / `edit` event but has no cost/token/byte fields.
- `Subscription` table stores tier (`free|pro|demo|enterprise`) but no price.
- Plan prices live nowhere.
- Admin page is a single scroll (KPI row + 1 chart + user table + activity).
- Chart library: Recharts (keep).

Stakeholders: CEO/operator (primary), future admin staff (secondary). Data latency expectation: minutes-fresh via tRPC query + manual refresh button (no SSE/WS).

## Goals / Non-Goals

**Goals:**
- Every API call writes its cost to `UsageLog` at insert time — no async job, no drift.
- Single `lib/pricing.ts` as the only place to change unit prices or plan prices.
- Dashboard tells the unit-economics story in <5 seconds of glance: MRR, this-month API spend, margin %, margin trend.
- 13 widgets delivered with zero new runtime dependencies (Recharts + custom SVG where needed).
- Historical data back-filled so charts don't have a visible cliff at deployment date.

**Non-Goals:**
- Stripe / real billing integration (deferred).
- Real-time (SSE/WS) updates.
- Email / Slack alerting (visual banner only).
- Multi-tenant / role-matrix RBAC beyond existing `admin` role.
- i18n / multi-language.
- Per-user self-service cost view (user-facing `usage-stats` untouched this round).

## Decisions

### D1. Cost fields on UsageLog vs. separate CostEvent table
**Decision**: Add nullable cost/token/byte columns directly on `UsageLog`.
**Rationale**: 1:1 with events we already write; no cross-table joins; trivial aggregation; nullable preserves back-compat for existing rows until backfill.
**Alternative considered**: Separate `CostEvent` table — rejected, adds write amplification (2 inserts per generation) and makes "cost per user" queries double-JOIN.

### D2. Cost calculation location
**Decision**: Compute cost in the chat route tool `execute` handlers (for Gemini image) and in `streamText` `onFinish` (for OpenRouter tokens + blob bytes), then pass payload into the `usageLog.create` call.
**Rationale**: We already create `UsageLog` rows there (lines 303-305, 420-422 of `route.ts`). Adding fields to the same `create` call avoids race conditions and doubles as the single audit trail.
**Alternative**: Prisma middleware intercepting `usageLog.create` — rejected, hides cost calculation far from the call site.

### D3. OpenRouter token source
**Decision**: Read `usage.inputTokens` / `usage.outputTokens` from AI SDK `onFinish` callback. Skip `/generation` endpoint lookup.
**Rationale**: Zero extra HTTP round-trip, zero rate-limit risk, accurate enough for budgeting (OpenRouter passes through Google pricing 1:1). Document the "within ~1% of actual OpenRouter invoice" tolerance.
**Attribution**: LLM cost is written to ONE synthetic UsageLog row per user message (`type: "llm"`) or added to the first `generate`/`edit` row of that turn. **Chosen**: new `type: "llm"` row at `onFinish` to keep types separable.

### D4. Blob cost
**Decision**: Record `blobBytes` (integer) at upload; compute monthly cost as `Σ(blobBytes) × $0.023 / (1024³) × (days_stored / 30)`. Approximate: treat stored-for-full-month when aggregating this month.
**Rationale**: True accounting requires lifecycle tracking (when deleted); we accept ~10% overstatement for the win of being able to attribute storage to users.

### D5. Plan pricing location
**Decision**: Constants in `web/src/lib/pricing.ts`:
```ts
export const PLAN_PRICE_USD = { free: 0, pro: 10, demo: 0, enterprise: 100 } as const
```
Temporary placeholder numbers as directed. Schema unchanged — pricing is not a DB concern until Stripe lands.
**Rationale**: Single file edit to change pricing; no migration to swap numbers.

### D6. MRR definition
**Decision**: `MRR = Σ(PLAN_PRICE_USD[sub.tier]) for sub where tier ∈ {pro, enterprise} AND user exists`. Demo excluded (free usage). No proration (no start/end dates on Subscription model yet).
**Churn proxy**: week-over-week drop in active Pro subscriptions. Documented as estimate.

### D7. Cohort retention
**Decision**: Weekly signup cohort × W0–W7. "Retained in week N" := user had ≥1 UsageLog event in the UTC week starting `cohortStart + N*7d`. 8-column heatmap.
**Rationale**: Simple, fits screen, W0–W7 window catches 2-month activation window typical for creator tools.

### D8. Funnel stages
**Decision**: 4 stages, each defined by earliest-timestamp query on existing tables:
1. Signup → `User.createdAt`
2. 첫 Project → earliest `Project.createdAt` per user
3. 첫 Generation → earliest `UsageLog.createdAt` per user
4. Pro/Enterprise 구독 → `Subscription` with tier upgraded from free
**Output**: counts per stage + conversion %.

### D9. Heatmap
**Decision**: 7×24 grid (요일 × 시간). Cell value = generation count in KST (user is in Korea). Quantile-based color scale (5 buckets) to avoid single outlier washing out the whole grid. Raw SVG, no Recharts (Recharts has no heatmap primitive worth wrapping).

### D10. Rate-limit / error panel
**Decision**: Parse existing `console.log(JSON.stringify({event:"gemini_request",...}))` stdout logs by tailing them server-side is **not feasible** on Vercel. Instead: add new `GeminiRequestLog` Prisma model written inside `gemini.ts` on every attempt with `status` (`"ok"|"retry"|"failed"`), `httpCode`, `latencyMs`, `attempt`. Aggregate in dashboard.
**Rationale**: Only way to get this data off Vercel's ephemeral function logs. Minor write amplification acceptable.

### D11. Popular keywords/styles
**Decision**: Static dictionary in `web/src/lib/style-keywords.ts` (e.g. `["minimalist","vintage","retro","geometric","gradient","flat","3d","mascot","wordmark","monogram",...]`). For each UsageLog row with a related `Logo.prompt`, match against dictionary case-insensitive, count matches. Computed on-query from last N days.
**Rationale**: Deterministic, cheap, no LLM cost. Extensible by editing one file.

### D12. Sample gallery
**Decision**: Latest 24 `LogoVersion.createdAt desc` with public URL. Admin-only, no filtering by user this round. 6×4 grid.

### D13. Activity feed (realtime-ish)
**Decision**: tRPC query returns last 50 events (`UsageLog` + `Subscription` tier changes). 무한스크롤 via cursor pagination. 수동 새로고침 버튼 + auto-refresh on tab focus.

### D14. Tab layout vs long scroll
**Decision**: 5 tabs — `개요 / 비용 / 수익 / 사용자 / 자료`. Rationale: 13 widgets would make a single-scroll page 6k+ pixels tall. URL state via `?tab=cost` for deep-linkable views.

### D15. Threshold alert banner
**Decision**: Compute on dashboard load:
- Gross margin this month < 70% → yellow banner
- Gemini error rate last 24h > 5% → red banner
- MRR MoM growth < 0% → yellow banner
Banner dismissible per session (localStorage), not per-rule.

### D16. Backfill strategy
**Decision**: `pnpm tsx scripts/backfill-usage-costs.ts` — one-shot, idempotent (`WHERE imageCostUsd IS NULL`). For each legacy row: `imageCostUsd = count × 0.134` for type=generate|edit. LLM cost left NULL (no token data in legacy rows). Banner in dashboard shows "Cost history estimated from unit prices before {deployDate}".

## Risks / Trade-offs

- [Risk] Gemini pricing changes silently → Mitigation: `pricing.ts` has a `LAST_VERIFIED` date comment + monthly calendar reminder for human check; dashboard displays "Prices as of YYYY-MM-DD".
- [Risk] OpenRouter `usage` object occasionally undefined → Mitigation: null-safe; write `llmCostUsd = null` and surface "N/A" in UI rather than zero.
- [Risk] Blob cost double-counting when images are deleted → Mitigation: accept ~10% overstatement; document; fix later with lifecycle hook.
- [Risk] Heatmap & funnel queries slow at scale → Mitigation: compose queries with indexed date ranges (`UsageLog(userId, createdAt)` index already exists); cache result in-memory per tRPC query for 60s.
- [Risk] 13 widgets = big PR, merge conflicts → Mitigation: split tasks by tab (개요 / 비용 / 수익 / 사용자 / 자료) with file allowlists; Coder agents parallel.
- [Trade-off] Placeholder pricing ($10/$100) is fake → Document in `pricing.ts` with TODO, owner = user. Dashboard number labels say "MRR (est.)" until real prices locked.
- [Trade-off] `GeminiRequestLog` new table adds write amplification → measured cost ~2 extra rows per generation; negligible.

## Migration Plan

1. Ship Prisma migration (new UsageLog columns + new `GeminiRequestLog` table) — backwards compatible.
2. Deploy code that writes cost fields going forward.
3. Run `scripts/backfill-usage-costs.ts` once on production.
4. Flip dashboard from old layout to new tabs in same deploy (no feature flag needed — admin-only).
5. Rollback = revert deploy. Migration leaves nullable columns; old code reads/writes them as NULL with no effect.

## Open Questions

- Should `demo` tier contribute to MRR at list price (as "would-be revenue")? **Default**: no, demo=$0.
- Image resolution: we currently always ask for 1K/2K. If we add 4K later, unit price field on `UsageLog` must be per-row, not global. **Default for now**: global constant, add field when 4K feature lands.
- "Popular style" dictionary language: Korean vs English prompts mix. **Default**: dictionary includes both Korean and English common terms.
