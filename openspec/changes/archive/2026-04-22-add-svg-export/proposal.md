## Why

The SVG export button in the gallery modal is currently a disabled "SVG 예정" placeholder. Users want to download their logos as vector SVG files for use beyond pixel-perfect PNGs (e.g., print, scaling, brand assets). An earlier Recraft-based `vectorize` tRPC mutation exists but is unwired, untracked in usage logs, and lacks admin/dashboard visibility. This change wires the button, formalizes usage tracking for vectorization (parity with Gemini image generation), and ensures SVG assets land in our Vercel Blob immediately — so we do not pay ongoing retention on any third-party provider.

## What Changes

- Activate SVG download button in gallery version modal (replace disabled `SVG 예정` span) with spinner + auto-download on success.
- Extend existing `export.vectorize` tRPC mutation to:
  - Use Recraft API with new key (env `RECRAFT_API_KEY` rotated to new value).
  - Upload resulting SVG to Vercel Blob immediately (already done; formalize).
  - Persist SVG URL on the same `LogoVersion` via a new `svgUrl` field (schema migration `add_svg_url_to_logo_version`).
  - Short-circuit when `svgUrl` already exists on the version (no API call, direct re-download).
  - Log each API attempt to a new `RecraftRequestLog` table (mirrors `GeminiRequestLog`).
  - Emit a `UsageLog` row with new `type: "vectorize"`, `imageCostUsd = $0.01` per success (via env `RECRAFT_VECTORIZE_USD`, default `0.01`).
  - Retry 429/5xx with exponential backoff 3× (2s → 4s → 8s).
- Surface vectorize usage in user dashboard (`UsageStats`): new KPI card "SVG exports" (today / lifetime) + vectorize series on existing 7-day chart.
- Surface vectorize cost + health in admin:
  - `CostTotalsRow` and `CostStackedArea` gain a vectorize series.
  - New `RecraftHealthPanel` on Overview tab (parallel to `GeminiHealthPanel`).
- **NOT** a LLM mention target — SVG URLs are export-only.

## Capabilities

### New Capabilities

None. All changes fit within existing capabilities.

### Modified Capabilities

- `export-pipeline`: Vectorize path now logs usage + persists `svgUrl` on `LogoVersion` + short-circuits duplicate calls.
- `usage-tracking`: `UsageLog.type` gains `"vectorize"`; new `RecraftRequestLog` table for per-call telemetry.
- `admin-cost-tracking`: Cost series includes vectorize; Overview gains Recraft health panel.
- `admin-dashboard-insights`: Overview Recraft health panel.
- `gallery-ui`: Version modal SVG button becomes functional with loading + auto-download UX.

## Impact

- **Code**: `web/src/server/routers/export.ts`, `web/src/components/gallery-panel.tsx`, `web/src/components/usage-stats.tsx`, `web/src/server/routers/usage.ts`, `web/src/app/admin/**` (cost + overview widgets), `web/prisma/schema.prisma`, new Prisma migration.
- **Schema**: Adds `LogoVersion.svgUrl String?`, new `RecraftRequestLog` model, widens `UsageLog.type` enum (string, no constraint change).
- **Env**: Rotates `RECRAFT_API_KEY` (new value supplied by user); adds `RECRAFT_VECTORIZE_USD` (default `0.01`).
- **Dependencies**: No new packages. Uses existing `@vercel/blob`, Recraft REST.
- **Ops**: User must update `RECRAFT_API_KEY` in Vercel dashboard manually for production.
