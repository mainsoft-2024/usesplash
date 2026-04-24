## MODIFIED Requirements

### Requirement: Unit price source of truth
The system SHALL expose a single TypeScript module `web/src/lib/pricing.ts` that defines every external-API unit price (Gemini image, OpenRouter input/output token, Vercel Blob $/GB-month, Recraft vectorize) and every subscription plan monthly price. No other file MAY hardcode these numbers.

`pricing.ts` MUST export `RECRAFT_VECTORIZE_USD` (default `0.01`, overridable via env `RECRAFT_VECTORIZE_USD`).

#### Scenario: Operator changes Gemini image price
- **WHEN** operator edits `GEMINI_IMAGE_PRICE_USD` in `pricing.ts` and redeploys
- **THEN** all future UsageLog inserts use the new unit price
- **AND** admin dashboard labels reflect the new price the moment the new build is live

#### Scenario: Operator changes Recraft vectorize price
- **WHEN** operator sets `RECRAFT_VECTORIZE_USD=0.02` env var and redeploys
- **THEN** future vectorize UsageLog rows use `0.02` for `imageCostUsd`
- **AND** existing rows are unchanged (price is captured at insert time)

#### Scenario: Non-pricing file hardcodes a number
- **WHEN** a PR introduces a literal dollar figure outside `pricing.ts`
- **THEN** code review MUST reject it (enforced by convention; `pricing.ts` is the contract)

## ADDED Requirements

### Requirement: Recraft vectorize cost tracking
Admin cost views SHALL treat vectorize events as a first-class cost series. Queries that aggregate `imageCostUsd` SHALL include rows where `type="vectorize"` alongside `type IN ("generate","edit")`, and SHALL expose vectorize as a separate series (not merged into "image cost"). `CostTotalsRow` and `CostStackedArea` on the admin Cost tab MUST show `vectorizeUsd` as a labeled dimension.

#### Scenario: Admin Cost tab shows vectorize series
- **WHEN** admin opens the Cost tab with a date range that includes vectorize events
- **THEN** `CostTotalsRow` displays a "Vectorize" tile with the summed `imageCostUsd` for `type="vectorize"` in that range
- **AND** `CostStackedArea` renders vectorize as a distinct colored series

#### Scenario: Per-user vectorize cost
- **WHEN** admin opens a user's detail page
- **THEN** vectorize cost is included in that user's lifetime + monthly cost breakdown as a separate line

### Requirement: Recraft request observability
The system SHALL persist every Recraft vectorize API attempt to `RecraftRequestLog` (parallel to `GeminiRequestLog`), so admin dashboards can compute vectorize rate-limit and error rates.

#### Scenario: Recraft call succeeds on first try
- **WHEN** vectorize returns 200 on attempt 1
- **THEN** one row with `status="ok"`, `attempt=1`, `httpCode=200`, `latencyMs` populated, `userId`, `projectId`, `logoId`, `versionId` set

#### Scenario: Recraft call retries then succeeds
- **WHEN** a vectorize call hits 429 twice then succeeds
- **THEN** 3 rows are written — two with `status="retry"`, one with `status="ok"`

#### Scenario: Recraft call exhausts retries
- **WHEN** all retries fail
- **THEN** the final row has `status="error"` with the last `httpCode` and `errorMessage`
