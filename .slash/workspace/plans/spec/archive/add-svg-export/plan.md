---
created: 2026-04-22T00:00:00Z
last_updated: 2026-04-22T00:00:00Z
type: spec
change_id: add-svg-export
status: pending
trigger: "Wire up SVG export button in gallery modal, extend Recraft vectorize mutation with logging + caching, surface vectorize usage + cost in user dashboard and admin."
---

# Plan: Activate SVG Export (Recraft vectorize) with Usage + Cost Tracking

## Background & Research

### OpenSpec sources (authoritative — read before editing)

- `openspec/changes/add-svg-export/proposal.md`
- `openspec/changes/add-svg-export/design.md`
- `openspec/changes/add-svg-export/tasks.md`
- `openspec/changes/add-svg-export/specs/export-pipeline/spec.md` (MODIFIED `SVG vectorization`, `Download exported files`)
- `openspec/changes/add-svg-export/specs/usage-tracking/spec.md` (MODIFIED `UsageLog event recording`; ADDED `Recraft per-call telemetry`)
- `openspec/changes/add-svg-export/specs/admin-cost-tracking/spec.md` (MODIFIED `Unit price source of truth`; ADDED `Recraft vectorize cost tracking`, `Recraft request observability`)
- `openspec/changes/add-svg-export/specs/admin-dashboard-insights/spec.md` (ADDED `Recraft rate-limit and error panel`, `User dashboard SVG export visibility`)
- `openspec/changes/add-svg-export/specs/gallery-ui/spec.md` (ADDED `SVG download in version modal`)

### External research (read for API contract details)

- `.slash/workspace/research/spec-svg-export-recraft-pricing.md` — Recraft vectorize: **$0.01/call** (10 API units), rate limit **5 req/s / 100 img/min**, `POST https://external.api.recraft.ai/v1/images/vectorize`, `multipart/form-data` with `file` field, response `{ image: { url } }`, **URL expires in ~24h** so must re-upload immediately, `Authorization: Bearer <key>`.

### Current state — exact snippets to edit

**1. `web/src/server/routers/export.ts` — current `vectorize` mutation (L99-146)**
```ts
vectorize: protectedProcedure
  .input(z.object({ logoVersionId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const version = await ctx.prisma.logoVersion.findUnique({
      where: { id: input.logoVersionId },
      include: { logo: { include: { project: { select: { userId: true } } } } },
    })

    if (!version || version.logo.project.userId !== ctx.session.user.id) {
      throw new Error("Version not found")
    }

    const apiKey = process.env.RECRAFT_API_KEY
    if (!apiKey) throw new Error("RECRAFT_API_KEY not configured")

    const imgRes = await fetch(version.imageUrl)
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

    const formData = new FormData()
    formData.append("file", new Blob([imgBuffer]), "image.png")

    const res = await fetch(
      "https://external.api.recraft.ai/v1/images/vectorize",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      },
    )

    if (!res.ok) throw new Error(`Recraft API error: ${res.statusText}`)
    const json = (await res.json()) as { image?: { url?: string } }
    const svgUrl = json.image?.url
    if (!svgUrl) throw new Error("No SVG URL in Recraft response")

    const svgRes = await fetch(svgUrl)
    const svgBuffer = Buffer.from(await svgRes.arrayBuffer())

    const key = getStorageKey(
      ctx.session.user.id,
      version.logo.projectId,
      version.logoId,
      `${version.id}-vector`,
      "svg",
    )
    const { url, bytes: _bytes } = await uploadImage(key, svgBuffer, "image/svg+xml")
    return { url, key }
  }),
```

**Key deltas required by spec:**
- Short-circuit when `version.svgUrl != null` → return `{ url: version.svgUrl, key, cached: true }`.
- Wrap Recraft call in `callRecraftVectorize(buffer)` helper with exponential backoff (2s → 4s → 8s, max 3 attempts) on 429/5xx; 4xx fails immediately.
- Write one `RecraftRequestLog` row per attempt (`status: "ok" | "retry" | "error"`, plus `httpCode`, `attempt`, `latencyMs`, `errorMessage`).
- Use storage key **without** the `-vector` suffix (spec says "under the version's storage key with `.svg` extension"). Switch to `getStorageKey(userId, projectId, logoId, version.id, "svg")`.
- Persist `LogoVersion.svgUrl = blob url` **and** write a `UsageLog` row **in the same Prisma transaction**.
- `UsageLog` row: `{ type: "vectorize", count: 1, imageCount: 1, model: "vectorize", imageCostUsd: RECRAFT_VECTORIZE_USD, blobBytes, blobCostUsd }`.
- Return `{ url, key, cached: false }` on fresh success.
- Error handling: throw `TRPCError({ code: "INTERNAL_SERVER_ERROR" or "BAD_REQUEST" })` with user-facing messages; never swallow.

**2. `web/prisma/schema.prisma` — models to edit**

LogoVersion (L84-100) — add `svgUrl String?` after `imageUrl`:
```prisma
model LogoVersion {
  id              String   @id @default(cuid())
  logoId          String
  versionNumber   Int
  parentVersionId String?
  imageUrl        String
  svgUrl          String?       // NEW
  s3Key           String
  ...
}
```

UsageLog (L126-146) — comment bump only (no schema change; `type` is free-form String):
```prisma
  type      String   // "generate" | "edit" | "llm" | "vectorize"
```

GeminiRequestLog (L148-162) — reference shape to mirror. Add new model at EOF:
```prisma
model RecraftRequestLog {
  id           String   @id @default(cuid())
  userId       String?
  projectId    String?
  logoId       String?
  versionId    String?
  model        String   // constant "vectorize"
  status       String   // "ok" | "retry" | "error"
  httpCode     Int?
  attempt      Int
  latencyMs    Int
  errorMessage String?
  createdAt    DateTime @default(now())

  @@index([createdAt])
  @@index([status, createdAt])
}
```

**3. `web/src/lib/pricing.ts` — current structure (full file, 34 lines)**
```ts
export const GEMINI_IMAGE_PRICE_USD = 0.134
export const OPENROUTER_INPUT_PRICE_PER_M = 0.5
export const OPENROUTER_OUTPUT_PRICE_PER_M = 3
export const BLOB_PRICE_PER_GB_MONTH = 0.023
// ...
export function imageCost(imageCount: number): number { return imageCount * GEMINI_IMAGE_PRICE_USD }
export function llmCost(inputTokens, outputTokens): number { ... }
export function blobCost(bytes: number): number { ... }
```

Add after `BLOB_PRICE_PER_GB_MONTH`:
```ts
export const RECRAFT_VECTORIZE_USD = Number(process.env.RECRAFT_VECTORIZE_USD ?? 0.01)
export function recraftVectorizeCost(count: number): number {
  return count * RECRAFT_VECTORIZE_USD
}
```

**4. `web/src/lib/storage.ts` — already supports SVG**
```ts
export function getStorageKey(userId, projectId, logoId, versionId, ext = "png") {
  return `users/${userId}/projects/${projectId}/logos/${logoId}/${versionId}.${ext}`
}
export async function uploadImage(key, body, contentType = "image/png"): Promise<{ url: string; bytes: number }> { ... }
```
Call as `uploadImage(key, svgBuffer, "image/svg+xml")`.

**5. tRPC context** (`web/src/lib/trpc/server.ts`): `protectedProcedure` gives `ctx.prisma` + `ctx.session.user.id`.

**6. `web/src/components/gallery-panel.tsx` — surrounding export buttons (L336-346)**
```tsx
<button onClick={() => handleDownload(mVer.imageUrl, `splash-logo-${mLogo?.orderIndex ?? 0}-v${mVer.versionNumber}.png`)} className="...PNG…">PNG 다운로드</button>
<button onClick={() => cropMut.mutate({ logoVersionId: mVer.id })} disabled={cropMut.isPending} className="...crop…">{cropMut.isPending ? "크롭 중..." : "크롭"}</button>
<span title="출시 예정" className="…disabled…">배경제거 <span className="…">예정</span></span>
<span title="출시 예정" className="…disabled…">SVG <span className="…">예정</span></span>   // L344 — REPLACE
```

`handleDownload` (L131-145) works with any URL + filename (it does `fetch → blob → <a download>`). Pass `.svg` filename.

`cropMut` pattern at L47: `const cropMut = trpc.export.crop.useMutation()`. Mirror for `svgMut = trpc.export.vectorize.useMutation()`.

After success, invalidate project/logo queries so the cached `svgUrl` propagates. Search for existing `utils = trpc.useUtils()` pattern in this file to reuse.

**7. `web/src/components/spinners.tsx`** — `PulseSpinner` (L9-41) is used elsewhere at 16px with `#4CAF50`. Reuse inline: `{svgMut.isPending && <PulseSpinner size={12} color="#4CAF50" />}`.

**8. `web/src/components/usage-stats.tsx`**
- KPI "사용량" block: L224-276 (circular ring + total count + 7-day sparkline).
- Daily chart: L279-301 (recharts `AreaChart` with 7/30/90 selector).
- Hooks at L136-138: `trpc.usage.getMyUsageStats.useQuery()`, `trpc.usage.getDailyChart.useQuery({ days })`, `trpc.usage.getDailyChart.useQuery({ days: 7 })`.
- Add a new KPI card "SVG exports" showing `vectorizeToday` / `vectorizeLifetime` from the extended `getMyUsageStats`.
- Add a vectorize area/line overlay on the daily chart using extended `getDailyChart` series.

**9. `web/src/server/routers/usage.ts` — current queries to extend**

`getMyUsageStats` (L11-45): aggregates `UsageLog.count` by `userId` + `createdAt >= todayMidnightUTC`. Returns `{ total, today, remaining, tier, dailyLimit }`.
- Add two parallel aggregates filtering `type: "vectorize"` → add `vectorizeToday` and `vectorizeLifetime` to return object.

`getDailyChart` (L47-86): returns `Array<{ date, count }>`. Fetches `UsageLog` with `select: { createdAt, count }`.
- Extend to select `type` too, group per date into `{ generate, edit, llm, vectorize, total }`, return new shape `Array<{ date: string; count: number; vectorize: number; ... }>`. Keep `count` as the total for backwards compat.

**10. `web/src/server/routers/admin-insights.ts` (or `admin.ts`) — existing cost query pattern**

`getCostBreakdown` (admin-insights.ts L247-279):
```ts
select: { createdAt: true, imageCostUsd: true, llmCostUsd: true, blobCostUsd: true },
// ...
const existing = map.get(key) ?? { date: key, gemini_image: 0, openrouter_llm: 0, vercel_blob: 0 }
existing.gemini_image += toNumber(row.imageCostUsd)
existing.openrouter_llm += toNumber(row.llmCostUsd)
existing.vercel_blob += toNumber(row.blobCostUsd)
```

Extension: also select `type`, and when `row.type === "vectorize"` route `row.imageCostUsd` to a new `recraft_vectorize` bucket instead of `gemini_image`. Shape becomes:
```ts
{ date: string; gemini_image: number; openrouter_llm: number; vercel_blob: number; recraft_vectorize: number }
```

`getGeminiHealth` (L612-634): queries last 24h of `GeminiRequestLog`, returns `{ rate429Pct24h, errorRatePct24h, avgRetries24h }`. Mirror as `getRecraftHealth`.

**11. `web/src/components/admin/gemini-health-panel.tsx` (L1-69) — template**
```tsx
const { data, isPending, isError } = api.adminInsights.getGeminiHealth.useQuery()
// ... skeleton + 3 KpiCard in grid
<KpiCard label="429 rate (24h)" value={formatPct(rate429)} trend={...} />
<KpiCard label="Error rate (24h)" value={formatPct(errorRate)} trend={...} />
<KpiCard label="Avg retries (24h)" value={retries.toFixed(2)} />
```

Copy to `recraft-health-panel.tsx`, swap to `getRecraftHealth`, labels: `"Vectorize 429 rate (24h)"`, `"Vectorize error rate (24h)"`, `"Avg vectorize retries (24h)"`. Handle zero-activity placeholder per spec scenario.

**12. `web/src/components/admin/cost-totals-row.tsx`**

Type (L11-15):
```ts
type CostBreakdownPoint = { gemini_image: number; openrouter_llm: number; vercel_blob: number }
```
Add `recraft_vectorize: number`. Extend reduce + cards array (L58-63) with `{ label: "Recraft Vectorize", value: totals.vectorize, color: "#ec4899" }`.

**13. `web/src/components/admin/cost-stacked-area.tsx`**

Type (L13-18) extended with `recraft_vectorize: number`. Chart color map (L20-24) + gradient defs + `<Area dataKey="recraft_vectorize" …>`.

**14. `web/src/app/admin/page.tsx` L74** — `<GeminiHealthPanel />` inside `xl:grid-cols-2`. Mount `<RecraftHealthPanel />` either inside the same grid (3 cols) or a sibling grid row below.

**15. `web/src/app/admin/users/[id]/page.tsx` L156-166** — 4-card KPI grid (구독가, LTV, 총 비용, 마진). Per spec `admin-cost-tracking` scenario "Per-user vectorize cost", the user detail page needs a vectorize line item. Simplest: extend the backing `getUserCostRevenue` query to include `vectorizeCostUsd` and add a 5th KpiCard "SVG 내보내기 비용".

**16. `web/src/app/providers.tsx` L32** — `<Toaster position="top-center" />` already mounted. Use `toast.error("SVG 변환에 실패했습니다")` / `toast.success(...)` from `sonner`.

### Env rotation (manual)

- `.env.local`: set `RECRAFT_API_KEY=jL0n75en7Wz7UIsSru3fwFGQnYXFfKgUGD48UALMd694rT8gD50704xWyUqPGaXL` and add `RECRAFT_VECTORIZE_USD=0.01`.
- `.env.example`: add placeholder lines `RECRAFT_API_KEY=` and `RECRAFT_VECTORIZE_USD=0.01`.
- **User action**: update `RECRAFT_API_KEY` in Vercel dashboard (Settings → Environment Variables, all environments) before production deploy. Coder must NOT commit the real key; `.env.local` is gitignored already.

## Testing Plan (TDD — tests first)

> **Note:** This repo does not currently have a formal test suite wired up (no `vitest`/`jest` configured; verification is via `pnpm build` + manual testing per `tasks.md §7`). The spec-defined scenarios are therefore validated through **manual test steps + DB assertions** listed below and in the Verification section. If the coder finds an existing test harness, they should add unit tests for `callRecraftVectorize` retry behavior first.

- [ ] T1 Document manual test script for first-time vectorize flow (Spec: export-pipeline `First-time vectorize`)
  - Create new logo + version via chat; confirm `svgUrl` is null in DB.
  - Click SVG button → expect DB: `LogoVersion.svgUrl` set, 1 `RecraftRequestLog(status="ok")`, 1 `UsageLog(type="vectorize", imageCostUsd=0.01)`.
- [ ] T2 Document manual test for cached repeat (Spec: export-pipeline `Repeat vectorize on same version`)
  - Click SVG twice on same version → expect no new Recraft calls on second, no new logs.
- [ ] T3 Document manual test for 429 retry (Spec: export-pipeline `Transient 429 retried`, usage-tracking `Retry then success`)
  - Temporarily mock `fetch` or toggle env to force 429, confirm `RecraftRequestLog` has ≥2 rows per attempt with correct status transitions.
- [ ] T4 Document manual test for non-transient 400 (Spec: export-pipeline `Non-transient failure surfaces`)
  - Feed invalid image → exactly 1 `RecraftRequestLog(status="error", httpCode=400)`, no retry, client shows toast.
- [ ] T5 Document manual test for exhausted retries (Spec: export-pipeline `All retries exhausted`)
  - Force 3× 503 → exactly 3 log rows (2 "retry", 1 "error"), no `UsageLog`, mutation rejects.
- [ ] T6 Document manual test for user dashboard rendering (Spec: admin-dashboard-insights `User views dashboard`)
  - After running T1, open `/dashboard` → "SVG exports" card shows `1 오늘 / 1 누적`, chart shows vectorize series on today's bucket.
- [ ] T7 Document manual test for admin health panel (Spec: admin-dashboard-insights `Operator opens Overview`)
  - Open `/admin` Overview → `RecraftHealthPanel` renders beside `GeminiHealthPanel` with data.
- [ ] T8 Document manual test for admin cost breakdown (Spec: admin-cost-tracking `Admin Cost tab shows vectorize series`)
  - `/admin` Cost tab → Recraft tile in totals row, vectorize area in stacked chart.
- [ ] T9 Document manual test for per-user cost (Spec: admin-cost-tracking `Per-user vectorize cost`)
  - `/admin/users/[id]` → vectorize cost line present.

## Implementation Plan

### Phase A — Schema + Pricing (maps to tasks.md §1)

- [x] A1 (tasks 1.1) Add `svgUrl String?` field to `LogoVersion` in `web/prisma/schema.prisma`
- [x] A2 (tasks 1.2) Add `RecraftRequestLog` model with all fields + 2 indexes at end of schema.prisma
- [x] A3 (tasks 1.3) Run `cd web && npx prisma migrate dev --name add_svg_url_to_logo_version`
- [x] A4 (tasks 1.4) Run `npx prisma generate`; confirm `src/generated/prisma/` updated
- [x] A5 (tasks 1.5) Add `RECRAFT_VECTORIZE_USD` const + `recraftVectorizeCost` helper in `web/src/lib/pricing.ts`
- [x] A6 (tasks 1.6) Update `.env.example` with `RECRAFT_API_KEY=` and `RECRAFT_VECTORIZE_USD=0.01` placeholders
- [x] A7 (tasks 1.6) Update `web/.env.local` to rotate `RECRAFT_API_KEY` to the new value and add `RECRAFT_VECTORIZE_USD=0.01`

### Phase B — Server: Vectorize mutation (maps to tasks.md §2)

- [x] B1 (tasks 2.1.2) Add inline helper `callRecraftVectorize(buffer, ctxMeta)` inside `web/src/server/routers/export.ts` that:
  - Iterates attempts 1..3
  - POSTs multipart/form-data to Recraft
  - Records `latencyMs = Date.now() - start` per attempt
  - On 429 or 5xx: writes `RecraftRequestLog{status:"retry"}`, waits 2s/4s/8s, retries
  - On 2xx: writes `RecraftRequestLog{status:"ok"}`, returns parsed body
  - On 4xx (non-429): writes `RecraftRequestLog{status:"error"}`, throws
  - After 3 failed attempts: final row upgraded to `status:"error"`, throws
- [x] B2 (tasks 2.1.1) Refactor `vectorize` procedure: after loading `version`, short-circuit if `version.svgUrl != null` → return `{ url: version.svgUrl, key: version.s3Key.replace(/\.png$/, ".svg"), cached: true }`
- [x] B3 (tasks 2.1.4) Swap storage key to `getStorageKey(userId, projectId, logoId, version.id, "svg")` (drop `-vector` suffix per spec)
- [x] B4 (tasks 2.1.5 + 2.1.6) Wrap DB writes in a single `ctx.prisma.$transaction([...])`:
  - Update `logoVersion.svgUrl` to new blob url
  - Create `UsageLog{ userId, projectId, type:"vectorize", count:1, imageCount:1, model:"vectorize", imageCostUsd: RECRAFT_VECTORIZE_USD, blobBytes, blobCostUsd: blobCost(blobBytes) }`
- [x] B5 (tasks 2.1.3) Ensure `RecraftRequestLog` writes pass `userId`, `projectId`, `logoId`, `versionId` derived from `version.logo` relation
- [x] B6 (tasks 2.1.7) Return `{ url, key, cached: false }` on fresh success
- [x] B7 (tasks 2.3) Wrap all thrown Errors as `TRPCError({ code: "INTERNAL_SERVER_ERROR", message })` with user-facing messages; no silent swallow. Import `TRPCError` from `@trpc/server`

### Phase C — Server: Usage + Admin queries (maps to tasks.md §3)

- [x] C1 (tasks 3.1) Extend `getMyUsageStats` in `web/src/server/routers/usage.ts` to run 2 additional `prisma.usageLog.count` aggregates filtered by `type: "vectorize"` (today + lifetime). Add `vectorizeToday` and `vectorizeLifetime` to the returned object
- [x] C2 (tasks 3.2) Extend `getDailyChart` to also select `type`, produce per-date buckets split by type, return `Array<{ date, count, generate, edit, llm, vectorize }>` (keep `count` as total for compat)
- [x] C3 (tasks 3.3) In `web/src/server/routers/admin-insights.ts` add `getRecraftHealth` adminProcedure mirroring `getGeminiHealth` (L612-634) but against `RecraftRequestLog`. Return `{ rate429Pct24h, errorRatePct24h, avgRetries24h, totalAttempts24h }`. Support empty-range `"No vectorize activity"` via `totalAttempts24h === 0`
- [x] C4 (tasks 3.3) Add companion `getRecraftAggregates` query that returns totals by status + p50/p95 latency over a date range (used by the health panel's detail rows, per spec)
- [x] C5 (tasks 3.4) Extend `getCostBreakdown` in `admin-insights.ts` to also select `type`; route `imageCostUsd` to new `recraft_vectorize` bucket when `type === "vectorize"`. Update return type to include `recraft_vectorize`
- [x] C6 (tasks 3.4) Extend `getUserCostRevenue` (per-user) to include `vectorizeCostUsd` aggregated from `UsageLog` where `type="vectorize"`

### Phase D — Client: Gallery SVG button (maps to tasks.md §4)

- [x] D1 (tasks 4.1, 4.2) In `web/src/components/gallery-panel.tsx`: at the `cropMut` declaration area (near L47) add `const svgMut = trpc.export.vectorize.useMutation()` and `const utils = trpc.useUtils()` (if not already present)
- [x] D2 (tasks 4.1) Replace L344 disabled `<span>…SVG 예정…</span>` with an enabled `<button>`:
  - Class mirrors the crop button style (L342)
  - `onClick` calls `svgMut.mutate({ logoVersionId: mVer.id })` via a new local async handler `handleSvgClick(mVer)`
  - `disabled={svgMut.isPending}`
  - Inline `PulseSpinner` + label toggle `"SVG 변환 중..."` / `"SVG 다운로드"`
- [x] D3 (tasks 4.3) Inside `handleSvgClick`, on mutate success call `handleDownload(result.url, `splash-logo-${mLogo?.orderIndex ?? 0}-v${mVer.versionNumber}.svg`)`
- [x] D4 (tasks 4.4) On mutate error, call `toast.error("SVG 변환에 실패했습니다. 잠시 후 다시 시도해 주세요.")` (import `toast` from `sonner`)
- [x] D5 (tasks 4.5) On success, call `utils.project.invalidate()` / `utils.logo.invalidate()` (use the specific invalidation keys already used in this file for existing mutations — grep for other `utils.` usages) so the cached `LogoVersion.svgUrl` propagates and the next click is a sub-100ms cached path

### Phase E — Client: Usage dashboard (maps to tasks.md §5)

- [ ] E1 (tasks 5.1) In `web/src/components/usage-stats.tsx` add a new KPI card titled **"SVG 내보내기"** showing `vectorizeToday` / `vectorizeLifetime` from the extended `getMyUsageStats`. Zero-state renders `"0 오늘 / 0 누적"` per spec scenario
- [ ] E2 (tasks 5.2) Add a vectorize `<Area dataKey="vectorize" />` layer to the existing recharts `AreaChart` (L279-301 region), stacked below `count` with a distinct color
- [ ] E3 (tasks 5.3) Update chart legend/tooltip to differentiate vectorize from generate/edit; pick a palette token consistent with admin-side (e.g. `#ec4899`)

### Phase F — Client: Admin Recraft health + cost (maps to tasks.md §6)

- [ ] F1 (tasks 6.1) Create `web/src/components/admin/recraft-health-panel.tsx` by copying `gemini-health-panel.tsx` structure. Swap query to `api.adminInsights.getRecraftHealth.useQuery()`. KPI labels: `"Vectorize 429 rate (24h)"`, `"Vectorize error rate (24h)"`, `"Avg vectorize retries (24h)"`. Render `"No vectorize activity"` placeholder when `totalAttempts24h === 0`
- [ ] F2 (tasks 6.2) Mount `<RecraftHealthPanel />` in `web/src/app/admin/page.tsx` — wrap in `<Suspense fallback={<WidgetSkeleton className="h-64" />}>`. Place in a new grid row below the existing xl:grid-cols-2 that contains GeminiHealthPanel (after L76)
- [ ] F3 (tasks 6.3) Update `web/src/components/admin/cost-totals-row.tsx`: add `recraft_vectorize: number` to `CostBreakdownPoint` type (L11-15), add to reduce accumulator, add 5th card `{ label: "Recraft Vectorize", value: totals.vectorize, color: "#ec4899" }`
- [ ] F4 (tasks 6.4) Update `web/src/components/admin/cost-stacked-area.tsx`: add `recraft_vectorize: number` to type (L13-18), add `recraft_vectorize: "#ec4899"` to color map (L20-24), add matching `<linearGradient id="recraft-vectorize-fill">` def, add `<Area type="monotone" dataKey="recraft_vectorize" stackId="cost" stroke={chartColors.recraft_vectorize} fill="url(#recraft-vectorize-fill)" />` (after L79)
- [ ] F5 (tasks 6.5) Update `web/src/app/admin/users/[id]/page.tsx`: extend the 4-card KPI grid (L156-166) into 5 cards by adding `<KpiCard label="SVG 내보내기 비용" value={formatUsd(userCostRevenue.vectorizeCostUsd)} />` (depends on C6)

## Parallelization Plan

### Batch 1 — Schema + Pricing (blocking — MUST complete first)
**Single coder** (schema migrations must be serialized to avoid conflicting Prisma client regen):
- [ ] **Coder Schema**: A1 – A7
  - Files: `web/prisma/schema.prisma`, `web/prisma/migrations/*` (generated), `web/src/lib/pricing.ts`, `web/.env.example`, `web/.env.local`
  - Runs `prisma migrate dev` + `prisma generate`

### Batch 2 — Server layer (parallel, file-disjoint)
Spawned after Batch 1 completes. All three touch strictly different files.

- [ ] **Coder Server-Export**: B1 – B7
  - Files: `web/src/server/routers/export.ts`
- [ ] **Coder Server-Usage**: C1, C2
  - Files: `web/src/server/routers/usage.ts`
- [ ] **Coder Server-Admin**: C3, C4, C5, C6
  - Files: `web/src/server/routers/admin-insights.ts` (or `admin.ts` — coder should confirm path)

### Batch 3 — Client layer (parallel, file-disjoint)
Spawned after Batch 2 completes (clients need tRPC types from extended routers).

- [ ] **Coder Client-Gallery**: D1 – D5
  - Files: `web/src/components/gallery-panel.tsx`
- [ ] **Coder Client-Usage**: E1 – E3
  - Files: `web/src/components/usage-stats.tsx`
- [ ] **Coder Client-Admin**: F1, F2, F3, F4, F5
  - Files: `web/src/components/admin/recraft-health-panel.tsx` (new), `web/src/app/admin/page.tsx`, `web/src/components/admin/cost-totals-row.tsx`, `web/src/components/admin/cost-stacked-area.tsx`, `web/src/app/admin/users/[id]/page.tsx`

### Dependencies

- Batch 1 → Batch 2: Batch 2 needs regenerated Prisma client with `LogoVersion.svgUrl` and `RecraftRequestLog` types, plus `RECRAFT_VECTORIZE_USD` from pricing.ts.
- Batch 2 → Batch 3: Batch 3 gallery button depends on mutation return shape `{ url, key, cached }`; usage/admin components depend on extended query return shapes.
- Within each batch, file boundaries are strict — no agent writes to another's file.

### Risk Areas

- **Storage key collision**: Current unwired code used `${version.id}-vector.svg` key; new code uses `${version.id}.svg`. Existing orphan blobs (if any) are acceptable per design.md. No migration needed.
- **`getDailyChart` return shape change** (Phase C2): breaks backward compat if the client doesn't handle new fields. Mitigation: keep `count` field populated as grand total.
- **`getCostBreakdown` type change** (Phase C5): admin cost-totals-row and cost-stacked-area must both update in lockstep with the query. Batch 3 Coder Client-Admin covers both files.
- **Per-user query `getUserCostRevenue`** (C6) — Coder Server-Admin must locate this in `admin-insights.ts` (not explored yet). If not present, the coder should grep for it and, if missing, skip F5's KpiCard (note in plan progress).
- **Env secret**: the real `RECRAFT_API_KEY` goes into `.env.local` (gitignored) only. `.env.example` gets the empty placeholder. **Vercel production env update is a user action** — must be documented in the final commit message / PR body, not executed.
- **Prisma `$transaction`** requires all writes in `ctx.prisma.$transaction([a, b])` form or passing a tx client. Coder Server-Export should pick the pattern already used elsewhere in the codebase (search for existing `$transaction` usage first).

## Per-agent prompt stubs

### Coder Schema (Batch 1)
```
TASK: Implement Phase A of .slash/workspace/plans/spec/add-svg-export/plan.md (tasks A1-A7).
PLAN: .slash/workspace/plans/spec/add-svg-export/plan.md
SPEC: openspec/changes/add-svg-export/ (read proposal.md, design.md, tasks.md §1, specs/export-pipeline/spec.md, specs/usage-tracking/spec.md, specs/admin-cost-tracking/spec.md)

FILE ALLOWLIST (touch ONLY these files):
- web/prisma/schema.prisma
- web/prisma/migrations/** (auto-generated by migrate dev — do not hand-edit)
- web/src/lib/pricing.ts
- web/.env.example
- web/.env.local

MUST DO:
- Add `svgUrl String?` to `LogoVersion` right after `imageUrl` (see plan's "Current state" snippets).
- Add `RecraftRequestLog` model at EOF with all fields + 2 indexes exactly as in the plan.
- Run `cd web && npx prisma migrate dev --name add_svg_url_to_logo_version` and commit the generated migration SQL.
- Run `npx prisma generate`.
- Add `RECRAFT_VECTORIZE_USD` const (with env override) + `recraftVectorizeCost` helper to pricing.ts per plan snippet.
- Append `RECRAFT_API_KEY=` and `RECRAFT_VECTORIZE_USD=0.01` to `.env.example` (placeholders only).
- In `.env.local` replace any existing `RECRAFT_API_KEY=...` line with the rotated value supplied in tasks.md. Also add `RECRAFT_VECTORIZE_USD=0.01` if missing.

MUST NOT DO:
- Do NOT commit the real `RECRAFT_API_KEY` to any tracked file. `.env.local` must stay gitignored (confirm).
- Do NOT edit any openspec/ files.
- Do NOT touch any other file outside the allowlist.
- Do NOT attempt to update Vercel production env vars — that is a manual user step.

VERIFY:
- `pnpm build` in `web/` passes with no TS errors (Prisma client picks up new fields).
- `git status` shows a new migration file under `web/prisma/migrations/`.
```

### Coder Server-Export (Batch 2)
```
TASK: Implement Phase B of .slash/workspace/plans/spec/add-svg-export/plan.md (tasks B1-B7).
PLAN: .slash/workspace/plans/spec/add-svg-export/plan.md
SPEC: openspec/changes/add-svg-export/specs/export-pipeline/spec.md, specs/usage-tracking/spec.md (MODIFIED Requirement: UsageLog event recording; ADDED Requirement: Recraft per-call telemetry)

FILE ALLOWLIST (touch ONLY):
- web/src/server/routers/export.ts

MUST DO:
- Add inline `callRecraftVectorize` helper with 3-attempt exponential backoff (2s/4s/8s) on 429/5xx; immediate fail on other 4xx.
- Each attempt writes one `RecraftRequestLog` row via `ctx.prisma.recraftRequestLog.create(...)` with `{ userId, projectId, logoId, versionId, model: "vectorize", status, httpCode, attempt, latencyMs, errorMessage }`.
- Short-circuit when `version.svgUrl` is non-null → return `{ url, key, cached: true }` with no DB writes.
- Use `getStorageKey(userId, projectId, logoId, version.id, "svg")` (drop `-vector` suffix).
- On success, use `ctx.prisma.$transaction([...])` to atomically update `LogoVersion.svgUrl` AND create `UsageLog{ type:"vectorize", count:1, imageCount:1, model:"vectorize", imageCostUsd: RECRAFT_VECTORIZE_USD, blobBytes: bytes, blobCostUsd: blobCost(bytes) }`.
- Return `{ url, key, cached: false }` on fresh success.
- Throw `TRPCError({ code: "INTERNAL_SERVER_ERROR", message: <user-friendly> })` on failure (import from `@trpc/server`).

MUST NOT DO:
- Do NOT edit the schema (Batch 1 already did).
- Do NOT edit any client components.
- Do NOT log to `UsageLog` on cached hits or on final error (per spec scenarios "Repeat vectorize" and "All retries exhausted").
- Do NOT change existing `crop` or other procedures in this file.

VERIFY:
- Types compile (`pnpm build`).
- Read the 5 export-pipeline scenarios in spec.md and walk through the code mentally — each must be satisfied.
```

### Coder Server-Usage (Batch 2)
```
TASK: Implement C1, C2 of .slash/workspace/plans/spec/add-svg-export/plan.md.
PLAN: .slash/workspace/plans/spec/add-svg-export/plan.md
SPEC: openspec/changes/add-svg-export/specs/admin-dashboard-insights/spec.md (Requirement: User dashboard SVG export visibility)

FILE ALLOWLIST (touch ONLY):
- web/src/server/routers/usage.ts

MUST DO:
- Extend `getMyUsageStats` to run two additional `prisma.usageLog.count` aggregates filtered by `type: "vectorize"` (today + lifetime). Add `vectorizeToday: number` and `vectorizeLifetime: number` to return.
- Extend `getDailyChart` to select `type`, group into per-date buckets split by type, return `Array<{ date, count, generate, edit, llm, vectorize }>` (keep `count` = grand total for backward compat).

MUST NOT DO:
- Do NOT change the existing `count`/`today`/`total` semantics.
- Do NOT edit other files.
- Do NOT break existing consumers of `getDailyChart` (old `{ date, count }` fields must remain present).

VERIFY:
- `pnpm build` passes.
- Mentally simulate dashboard scenario "User with zero exports" — both new fields return 0, chart series flat.
```

### Coder Server-Admin (Batch 2)
```
TASK: Implement C3, C4, C5, C6 of .slash/workspace/plans/spec/add-svg-export/plan.md.
PLAN: .slash/workspace/plans/spec/add-svg-export/plan.md
SPEC: openspec/changes/add-svg-export/specs/admin-cost-tracking/spec.md, specs/admin-dashboard-insights/spec.md (Requirement: Recraft rate-limit and error panel)

FILE ALLOWLIST (touch ONLY):
- web/src/server/routers/admin-insights.ts (confirm path — may be admin.ts)

MUST DO:
- Add `getRecraftHealth` adminProcedure mirroring `getGeminiHealth` (see plan's snippet at L612-634). Query `RecraftRequestLog` last 24h. Return `{ rate429Pct24h, errorRatePct24h, avgRetries24h, totalAttempts24h }`.
- Add `getRecraftAggregates` adminProcedure: totals by status + p50/p95 latency over an input date range.
- Extend `getCostBreakdown` to also select `type`; route `imageCostUsd` into new `recraft_vectorize` bucket when `type === "vectorize"` (i.e. NOT into `gemini_image`). Update returned row shape to include `recraft_vectorize: number`.
- Extend `getUserCostRevenue` (search for it first — if not found, report back with path so planner can adjust): include `vectorizeCostUsd: number` summed from UsageLog where `userId = X AND type = "vectorize"`.

MUST NOT DO:
- Do NOT edit the Gemini queries.
- Do NOT modify client components.
- Do NOT rename existing fields in `CostBreakdownPoint` — only add.

VERIFY:
- `pnpm build` passes.
- Walk through admin-cost-tracking scenarios "Admin Cost tab shows vectorize series" and "Per-user vectorize cost" — queries must return the expected shape.
```

### Coder Client-Gallery (Batch 3)
```
TASK: Implement Phase D of .slash/workspace/plans/spec/add-svg-export/plan.md (D1-D5).
PLAN: .slash/workspace/plans/spec/add-svg-export/plan.md
SPEC: openspec/changes/add-svg-export/specs/gallery-ui/spec.md (Requirement: SVG download in version modal)

FILE ALLOWLIST (touch ONLY):
- web/src/components/gallery-panel.tsx

MUST DO:
- Near the `cropMut` hook (~L47), add `const svgMut = trpc.export.vectorize.useMutation()` and `const utils = trpc.useUtils()` (reuse existing if present).
- Replace L344 disabled `<span>…SVG 예정…</span>` with an active `<button>` mirroring the crop button style (L342).
- Button behavior:
  - `onClick`: call a new async handler `handleSvgClick(mVer)` that awaits `svgMut.mutateAsync({ logoVersionId: mVer.id })` and then calls `handleDownload(result.url, \`splash-logo-${mLogo?.orderIndex ?? 0}-v${mVer.versionNumber}.svg\`)`.
  - `disabled={svgMut.isPending}`.
  - Content: `{svgMut.isPending ? "SVG 변환 중..." : "SVG 다운로드"}` with `<PulseSpinner size={12} color="#4CAF50" />` while pending (import from `./spinners`).
- On error, `toast.error("SVG 변환에 실패했습니다. 잠시 후 다시 시도해 주세요.")` (import `toast` from `sonner`).
- On success, invalidate tRPC query caches that hold `LogoVersion` (grep for existing `utils.project.*.invalidate()` or `utils.logo.*.invalidate()` patterns in this file and mirror them) so `svgUrl` propagates and subsequent clicks are cached.

MUST NOT DO:
- Do NOT touch the PNG button, crop button, or remove-bg span — only replace the SVG span.
- Do NOT bypass `handleDownload`; reuse the existing helper.
- Do NOT edit any other file.

VERIFY:
- `pnpm build` passes.
- Walk through gallery-ui scenarios "First SVG download", "Cached SVG download", "Error UX" — behavior matches.
```

### Coder Client-Usage (Batch 3)
```
TASK: Implement Phase E of .slash/workspace/plans/spec/add-svg-export/plan.md (E1-E3).
PLAN: .slash/workspace/plans/spec/add-svg-export/plan.md
SPEC: openspec/changes/add-svg-export/specs/admin-dashboard-insights/spec.md (Requirement: User dashboard SVG export visibility)

FILE ALLOWLIST (touch ONLY):
- web/src/components/usage-stats.tsx

MUST DO:
- Read `vectorizeToday` + `vectorizeLifetime` from `trpc.usage.getMyUsageStats.useQuery()` result (field added by Coder Server-Usage).
- Add a new KPI card titled "SVG 내보내기" showing `{vectorizeToday} 오늘 / {vectorizeLifetime} 누적`. Place it in the KPI section (L224-276 neighborhood) so it sits alongside the existing usage ring.
- Read the new `vectorize` field from each bucket in `trpc.usage.getDailyChart.useQuery({ days })` response and add an `<Area dataKey="vectorize" stackId="…" stroke="#ec4899" fill="…" />` layer to the daily chart (L279-301). Ensure the legend/tooltip distinguishes the series.
- Zero-state: if both counts are 0, card shows "0 오늘 / 0 누적" (no crash / empty render).

MUST NOT DO:
- Do NOT refactor the existing ring or chart beyond adding the vectorize series.
- Do NOT edit server routers.

VERIFY:
- `pnpm build` passes.
- Scenarios "User views dashboard" and "User with zero exports" both render correctly.
```

### Coder Client-Admin (Batch 3)
```
TASK: Implement Phase F of .slash/workspace/plans/spec/add-svg-export/plan.md (F1-F5).
PLAN: .slash/workspace/plans/spec/add-svg-export/plan.md
SPEC: openspec/changes/add-svg-export/specs/admin-cost-tracking/spec.md, specs/admin-dashboard-insights/spec.md (Recraft rate-limit and error panel; Recraft vectorize cost tracking)

FILE ALLOWLIST (touch ONLY):
- web/src/components/admin/recraft-health-panel.tsx       (NEW)
- web/src/app/admin/page.tsx
- web/src/components/admin/cost-totals-row.tsx
- web/src/components/admin/cost-stacked-area.tsx
- web/src/app/admin/users/[id]/page.tsx

MUST DO:
- F1: Copy `web/src/components/admin/gemini-health-panel.tsx` to `recraft-health-panel.tsx`. Swap query to `api.adminInsights.getRecraftHealth.useQuery()`. KPI labels: "Vectorize 429 rate (24h)", "Vectorize error rate (24h)", "Avg vectorize retries (24h)". If `totalAttempts24h === 0`, render "No vectorize activity" placeholder inside the panel frame.
- F2: Mount `<RecraftHealthPanel />` inside `<Suspense fallback={<WidgetSkeleton className="h-64" />}>` in the admin Overview tab (after L76 of `admin/page.tsx`). Place in a new `grid grid-cols-1 xl:grid-cols-2` row immediately below the Gemini row.
- F3: Update `cost-totals-row.tsx`: add `recraft_vectorize: number` field to `CostBreakdownPoint` type (L11-15), add `acc.recraft_vectorize += row.recraft_vectorize` in reduce, add card `{ label: "Recraft Vectorize", value: totals.vectorize, color: "#ec4899" }` to cards array (L58-63).
- F4: Update `cost-stacked-area.tsx`: add `recraft_vectorize: number` to type (L13-18), add `recraft_vectorize: "#ec4899"` to `chartColors` (L20-24), add matching `<linearGradient id="recraft-vectorize-fill">` (mirror existing gradient pattern near L39-50), add `<Area type="monotone" dataKey="recraft_vectorize" stackId="cost" stroke={chartColors.recraft_vectorize} fill="url(#recraft-vectorize-fill)" />` after L79.
- F5: Update `admin/users/[id]/page.tsx`: read `userCostRevenue.vectorizeCostUsd` (new field from C6) and add a 5th `<KpiCard label="SVG 내보내기 비용" value={formatUsd(userCostRevenue.vectorizeCostUsd)} />` in the existing grid (L156-166). Bump grid from `lg:grid-cols-4` to `lg:grid-cols-5` (or use 2-row layout if design prefers).

MUST NOT DO:
- Do NOT rename existing fields on `CostBreakdownPoint` — only add.
- Do NOT touch `gemini-health-panel.tsx`.
- Do NOT edit server routers.

VERIFY:
- `pnpm build` passes.
- Admin "Operator opens Overview" and "Admin Cost tab shows vectorize series" scenarios render with correct data.
- "No vectorize activity" placeholder appears on a fresh DB.
```

## Done Criteria

Derived from `openspec/changes/add-svg-export/tasks.md §7`:

- [ ] DC1 `pnpm build` in `web/` passes with zero TS errors (tasks 7.1)
- [ ] DC2 Manual test: first-time SVG export on a new version writes exactly 1 `LogoVersion.svgUrl`, 1 `RecraftRequestLog(status="ok")`, 1 `UsageLog(type="vectorize", imageCostUsd=0.01)` (tasks 7.2)
- [ ] DC3 Manual test: repeat SVG export on same version writes no new rows and downloads immediately (tasks 7.3)
- [ ] DC4 Manual test: simulated 429 retry produces multiple `RecraftRequestLog` rows with correct status progression (tasks 7.4)
- [ ] DC5 User dashboard shows "SVG 내보내기" KPI card + vectorize chart series (tasks 7.5)
- [ ] DC6 Admin Overview renders `RecraftHealthPanel` with live data (tasks 7.6)
- [ ] DC7 Admin Cost tab shows vectorize as separate series in `CostTotalsRow` + `CostStackedArea` (tasks 7.7)
- [ ] DC8 README/PR body reminds user to update `RECRAFT_API_KEY` in Vercel production env BEFORE deploy (tasks 7.8) — this is a manual user step, not executed by coders
- [ ] DC9 All OpenSpec scenarios in `specs/export-pipeline/spec.md`, `specs/usage-tracking/spec.md`, `specs/admin-cost-tracking/spec.md`, `specs/admin-dashboard-insights/spec.md`, `specs/gallery-ui/spec.md` pass manual walk-through

### Task-to-spec traceability (1:1 mapping summary)

| Plan step | tasks.md checkbox | Primary spec scenario |
|-----------|-------------------|-----------------------|
| A1 | 1.1 | schema.prisma change |
| A2 | 1.2 | usage-tracking `Recraft per-call telemetry` |
| A3 | 1.3 | migration file |
| A4 | 1.4 | client regen |
| A5 | 1.5 | admin-cost-tracking `Unit price source of truth` |
| A6-A7 | 1.6 | env rotation |
| B1 | 2.1.2 | export-pipeline `Transient 429 retried` + `All retries exhausted` |
| B2 | 2.1.1 | export-pipeline `Repeat vectorize on same version` |
| B3 | 2.1.4 | export-pipeline `Download exported files` |
| B4 | 2.1.5 + 2.1.6 | export-pipeline `First-time vectorize` + usage-tracking `Vectorize export records full cost` |
| B5 | 2.1.3 | usage-tracking `Successful first attempt`, `Retry then success`, `Error without retry` |
| B6 | 2.1.7 | export-pipeline `First-time vectorize` |
| B7 | 2.3 | export-pipeline `Non-transient failure surfaces` |
| C1 | 3.1 | admin-dashboard-insights `User views dashboard` |
| C2 | 3.2 | admin-dashboard-insights `User with zero exports` |
| C3-C4 | 3.3 | admin-dashboard-insights `Operator opens Overview`, `No vectorize activity` |
| C5 | 3.4 | admin-cost-tracking `Admin Cost tab shows vectorize series` |
| C6 | 3.4 | admin-cost-tracking `Per-user vectorize cost` |
| D1-D5 | 4.1-4.5 | gallery-ui `First SVG download`, `Cached SVG download`, `Error UX` |
| E1-E3 | 5.1-5.3 | admin-dashboard-insights `User views dashboard` |
| F1 | 6.1 | admin-dashboard-insights `Operator opens Overview` |
| F2 | 6.2 | admin-dashboard-insights `Operator opens Overview` |
| F3 | 6.3 | admin-cost-tracking `Admin Cost tab shows vectorize series` |
| F4 | 6.4 | admin-cost-tracking `Admin Cost tab shows vectorize series` |
| F5 | 6.5 | admin-cost-tracking `Per-user vectorize cost` |
