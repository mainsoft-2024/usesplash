## Context

- Existing `export.vectorize` tRPC mutation at `web/src/server/routers/export.ts` (~L99-146) already calls Recraft (`https://external.api.recraft.ai/v1/images/vectorize`) and uploads the returned SVG to Vercel Blob with suffix `-vector.svg`. It is unwired in the UI and does not persist the URL nor log usage.
- UI button at `web/src/components/gallery-panel.tsx:344` is a disabled `<span>` with text "SVG 예정".
- Usage telemetry uses two tables: `UsageLog` (aggregated per event with cost fields) and `GeminiRequestLog` (per-call health/retry telemetry). Dashboard `UsageStats` reads from `UsageLog`; admin Overview has `GeminiHealthPanel` that reads from `GeminiRequestLog`.
- Recraft vectorize cost is **$0.01 / call** (10 API units, 1000 units = $1.00). Rate limit 5 req/s, 100 img/min. Response: `{ image: { url } }` — URL is ephemeral, must be downloaded & re-uploaded to our Blob within the request window.
- User-supplied new `RECRAFT_API_KEY`: `jL0n75en7Wz7UIsSru3fwFGQnYXFfKgUGD48UALMd694rT8gD50704xWyUqPGaXL` (rotated).

## Goals / Non-Goals

**Goals:**
- Functional SVG download from the gallery version modal in ≤ 1 click, with auto-download on success.
- Every Recraft call logged with attempt/status/latency for admin telemetry (parity with Gemini).
- Every successful vectorize emits a `UsageLog` row usable by existing aggregation queries with zero query changes (new `type = "vectorize"` string).
- SVG assets persist on our Blob + are referenced from `LogoVersion.svgUrl`, so repeat clicks cost nothing.
- Admin cost charts include vectorize cost as a separate series.
- User dashboard shows SVG export counts (today / lifetime) + vectorize overlay on the 7-day chart.

**Non-Goals:**
- Switching away from Recraft (Vectorizer.ai explored but rejected by user).
- Rate-limiting per user / gating behind subscription tier (future).
- Making SVG URLs mentionable in chat (`edit_logo` tool) — SVG is export-only.
- Background-removal / crop changes (untouched).
- Server-sent progress events — spinner is sufficient for 2-5s calls.

## Decisions

### 1. Schema: add `svgUrl` to `LogoVersion`, do NOT create a new version row
**Why:** User answered Q explicitly — SVG is a derivative artifact of the same version, not a version bump. Avoids cluttering the gallery with phantom versions. Lets us short-circuit repeat exports by checking `svgUrl != null`.
**Alternative rejected:** New `LogoVersion` row per export (current `-vector` blob pattern but persisted) — creates confusing version tree, makes "PNG vs SVG of same logo" hard to group.

### 2. New `RecraftRequestLog` table mirroring `GeminiRequestLog`
**Why:** Per-call telemetry (attempt, http code, latency, error) is required for admin health panel. Rolling it into `UsageLog` would pollute aggregation queries and lose per-attempt granularity on retries.
**Fields:** `id`, `userId`, `projectId`, `logoId?`, `versionId?`, `model` ("vectorize"), `status`, `httpCode`, `attempt`, `latencyMs`, `errorMessage`, `createdAt`. Indexes: `[createdAt]`, `[status, createdAt]`. (We do include `logoId`/`versionId` for forensics — tiny cost, high debug value.)

### 3. Extend `UsageLog.type` with `"vectorize"` (no schema change)
**Why:** `UsageLog.type` is a free-form `String`. Existing aggregation already groups by `type`, so admin/dashboard queries auto-pick up the new type by filter. `imageCount = 1`, `imageCostUsd = RECRAFT_VECTORIZE_USD` (env, default `0.01`).

### 4. Retry policy: exponential backoff 3 attempts on 429/5xx
**Why:** Mirrors `withGeminiConcurrency` pattern. Recraft rate-limit is 5 req/s, so bursts are realistic. 4xx (other) = immediate fail.
**Implementation:** inline helper in `export.ts` (no new file). Each attempt logs a `RecraftRequestLog` row.

### 5. Short-circuit when `svgUrl` is already set on the version
**Why:** Prevents accidental double-billing on user re-click. Zero UsageLog rows emitted on cache hit. Client gets `{ url, key, cached: true }`.
**Migration path for existing versions:** `svgUrl` starts null for all rows; first export populates it.

### 6. Button UX: spinner + disable + auto-download
**Why:** Matches existing `handleDownload` PNG path. Users expect a single click → file.
**Implementation:** Reuse `handleDownload(svgUrl)`. Disable button while `mutation.isPending`. Show inline spinner (reuse `web/src/components/spinners.tsx`).

### 7. API key rotation
**Why:** User provided a new key. Replace `.env.local` and `.env.example` placeholder. Vercel production env requires manual update (documented in tasks).
**Secret handling:** Never committed; tasks call out both local + Vercel update.

### 8. Admin: reuse `GeminiHealthPanel` component shape for Recraft
**Why:** Minimizes divergence. Same three widgets: totals, error-rate, latency p50/p95.
**Implementation:** New `RecraftHealthPanel` component + tRPC sub-router `admin.recraft` (or extend existing admin router) reading from `RecraftRequestLog`.

### 9. Cost charts: add vectorize as separate series
**Why:** Accurate cost breakdown. `CostTotalsRow` sums `imageCostUsd` where `type = "vectorize"`; `CostStackedArea` includes a new dimension.
**Implementation:** Extend existing admin cost tRPC queries to include a `vectorizeUsd` field alongside existing `imageUsd`/`llmUsd`/`blobUsd`.

## Risks / Trade-offs

- **Recraft URL expiry race** → Mitigation: already download-and-reupload synchronously before returning.
- **Duplicate vectorize triggered by double-click** → Mitigation: client-side `mutation.isPending` disables button; server-side short-circuit on `svgUrl` existence idempotently handles retry.
- **Migration of existing production rows** → Mitigation: `svgUrl` is nullable; no data backfill needed. Existing `-vector.svg` blobs (if any were produced by the unwired old path) become orphan — acceptable.
- **Admin cost query fanout** → Mitigation: `UsageLog` is already indexed on `[userId, createdAt]` and `[userId, type]`; adding a filter on `type = "vectorize"` is cheap.
- **Per-call USD drift if Recraft changes pricing** → Mitigation: `RECRAFT_VECTORIZE_USD` env var; rate recorded at log-time (immutable per row).
- **LSP / Prisma 7 client regen** → Mitigation: tasks include `npx prisma generate` after schema edit.

## Migration Plan

1. Apply Prisma migration `add_svg_url_to_logo_version` (adds `svgUrl String?` on `LogoVersion`, creates `RecraftRequestLog` table).
2. Deploy server code (safe — new column nullable, new table unused-if-unwritten).
3. Deploy client code (button activates).
4. User updates `RECRAFT_API_KEY` in Vercel production env (manual step, documented).
5. No rollback concerns: schema additions are backwards-compatible; code respects null `svgUrl`.

## Open Questions

None — all resolved during interview rounds.
