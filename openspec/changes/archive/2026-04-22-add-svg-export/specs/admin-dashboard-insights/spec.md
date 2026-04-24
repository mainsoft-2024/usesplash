## ADDED Requirements

### Requirement: Recraft rate-limit and error panel
The admin Overview tab SHALL include a `RecraftHealthPanel` component, parallel to `GeminiHealthPanel`, summarizing vectorize health over the selected date range: total attempts, success rate, error rate by HTTP code, p50/p95 latency. Data source: `RecraftRequestLog`.

#### Scenario: Operator opens Overview
- **WHEN** admin opens the Overview tab
- **THEN** the Recraft health panel renders alongside Gemini health panel
- **AND** shows counts by status and p50/p95 latency for the active date range

#### Scenario: No vectorize activity
- **WHEN** the date range has zero vectorize attempts
- **THEN** the panel shows "No vectorize activity" placeholder without erroring

### Requirement: User dashboard SVG export visibility
The user dashboard `UsageStats` component SHALL include a "SVG exports" KPI card showing today's count and lifetime count, sourced from `UsageLog` where `type="vectorize"`. The existing 7/30/90-day chart SHALL include a vectorize series layered on top of generate/edit.

#### Scenario: User views dashboard
- **WHEN** a user with past vectorize events opens their dashboard
- **THEN** the "SVG exports" card displays the correct today + lifetime count
- **AND** the 7-day chart shows a vectorize line/area

#### Scenario: User with zero exports
- **WHEN** a user who has never exported SVG opens their dashboard
- **THEN** the card shows "0 오늘 / 0 누적" and the chart vectorize series is flat at zero
