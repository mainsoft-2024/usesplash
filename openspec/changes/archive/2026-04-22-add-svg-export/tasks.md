## 1. Schema & Pricing

- [x] 1.1 Add `svgUrl String?` to `LogoVersion` in `web/prisma/schema.prisma`
- [x] 1.2 Add `RecraftRequestLog` model (userId, projectId, logoId?, versionId?, model, status, httpCode?, attempt, latencyMs, errorMessage?, createdAt) with indexes `[createdAt]` and `[status, createdAt]`
- [x] 1.3 Run `npx prisma migrate dev --name add_svg_url_to_logo_version` from `web/`
- [x] 1.4 Verify generated client picks up new types (`npx prisma generate`)
- [x] 1.5 Add `RECRAFT_VECTORIZE_USD` constant + env override to `web/src/lib/pricing.ts`
- [x] 1.6 Update `.env.example` with `RECRAFT_API_KEY` (placeholder) and `RECRAFT_VECTORIZE_USD=0.01`; update `.env.local` with real new key

## 2. Server: Recraft integration + logging

- [x] 2.1 Refactor `web/src/server/routers/export.ts` `vectorize` mutation:
  - [x] 2.1.1 Short-circuit if `LogoVersion.svgUrl` is already set → return `{ url, key, cached: true }` without API call
  - [x] 2.1.2 Implement inline helper `callRecraftVectorize(buffer)` with exponential backoff (2s/4s/8s) on 429/5xx, max 3 attempts
  - [x] 2.1.3 Write one `RecraftRequestLog` row per attempt (status: "retry"|"ok"|"error", httpCode, attempt, latencyMs, errorMessage)
  - [x] 2.1.4 On success: download SVG from Recraft response URL, upload to Vercel Blob under version's storage key with `.svg` extension
  - [x] 2.1.5 Update `LogoVersion.svgUrl` in DB (single transaction with UsageLog write)
  - [x] 2.1.6 Write `UsageLog` row with type="vectorize", count=1, imageCount=1, model="vectorize", imageCostUsd=RECRAFT_VECTORIZE_USD, blobBytes, blobCostUsd
  - [x] 2.1.7 Return `{ url, key, cached: false }`
- [x] 2.2 Ensure mutation context has `userId`, `projectId`, `logoId`, `versionId` for logging
- [x] 2.3 Error handling: rethrow user-friendly TRPC errors; no silent swallowing

## 3. Server: Admin + usage queries

- [x] 3.1 Extend `web/src/server/routers/usage.ts` `getMyUsageStats` to return `vectorizeToday` and `vectorizeLifetime` counts
- [x] 3.2 Extend `getDailyChart` to include a `vectorize` series per bucket
- [x] 3.3 Add admin tRPC query for `RecraftRequestLog` aggregates (totals by status, p50/p95 latency, by httpCode) scoped to a date range
- [x] 3.4 Extend admin cost aggregation queries to expose `vectorizeUsd` as a separate field in `CostTotalsRow` / `CostStackedArea` responses

## 4. Client: Gallery SVG button

- [x] 4.1 In `web/src/components/gallery-panel.tsx`, replace the disabled "SVG 예정" span (L344) with a functional button
- [x] 4.2 Wire to `trpc.export.vectorize.useMutation()`; disable + inline spinner while `mutation.isPending`
- [x] 4.3 On success, call existing `handleDownload(url)` to trigger browser download of the SVG (respect `.svg` filename)
- [x] 4.4 On error, show toast via existing `sonner` and re-enable button
- [x] 4.5 Invalidate relevant tRPC queries (logos/versions) after success so `svgUrl` propagates

## 5. Client: Usage dashboard

- [x] 5.1 Add "SVG exports" KPI card in `web/src/components/usage-stats.tsx` showing today + lifetime counts
- [x] 5.2 Add vectorize series layer on existing 7/30/90-day chart
- [x] 5.3 Ensure chart legend + colors distinguish vectorize from generate/edit

## 6. Client: Admin

- [x] 6.1 Create `web/src/components/admin/recraft-health-panel.tsx` modeled after `gemini-health-panel.tsx` — renders totals/error rate/latency p50-p95 from the new admin query
- [x] 6.2 Mount `RecraftHealthPanel` in admin Overview tab beside `GeminiHealthPanel`
- [x] 6.3 Update `CostTotalsRow` to render a "Vectorize" tile
- [x] 6.4 Update `CostStackedArea` to render a vectorize series (new color token)
- [x] 6.5 Update admin user detail page to include vectorize cost line item

## 7. Verification

- [x] 7.1 `pnpm build` in `web/` passes with no TS errors
- [ ] 7.2 Manual test: first-time SVG export on a new version → DB has `svgUrl`, one `RecraftRequestLog`, one `UsageLog(type="vectorize")`
- [ ] 7.3 Manual test: repeat SVG export on same version → no new logs, immediate download
- [ ] 7.4 Manual test: simulated 429 retry path writes multiple RecraftRequestLog rows (can be asserted via a single mock or temporary breakpoint)
- [ ] 7.5 User dashboard reflects new KPI card + vectorize chart series
- [ ] 7.6 Admin Overview renders `RecraftHealthPanel` with data
- [ ] 7.7 Admin Cost tab shows vectorize as a separate series in totals + stacked area
- [x] 7.8 User is reminded to set `RECRAFT_API_KEY` in Vercel production environment before deploy (already set via `vercel env add`)
