# admin-revenue-analytics

## Purpose
Define subscription-based revenue analytics and margin metrics (MRR/ARR/LTV/churn/burn) for admin decision-making.

## Requirements

### Requirement: Plan price constants
The system SHALL define monthly plan prices in `web/src/lib/pricing.ts` under `PLAN_PRICE_USD`. Values are placeholders until real billing lands (initial: free=0, pro=10, demo=0, enterprise=100).

#### Scenario: Operator needs to update Pro price
- **WHEN** operator changes `PLAN_PRICE_USD.pro` and redeploys
- **THEN** all MRR/ARR/LTV calculations use the new value

### Requirement: MRR calculation
The system SHALL compute Monthly Recurring Revenue as the sum of `PLAN_PRICE_USD[sub.tier]` across all `Subscription` rows whose tier is in `{pro, enterprise}`. Free and demo tiers MUST NOT contribute.

#### Scenario: Mix of tiers
- **WHEN** the database has 10 pro subs and 2 enterprise subs (prices 10 and 100)
- **THEN** MRR = 10×10 + 2×100 = $300

#### Scenario: Subscription exists but user deleted
- **WHEN** a Subscription row points to a user that no longer exists
- **THEN** it is excluded from MRR

### Requirement: MoM growth and ARR
The system SHALL expose `mrrThisMonth`, `mrrLastMonth`, `mrrGrowthPct`, `arr` (=12×mrrThisMonth) as admin-dashboard numbers.

#### Scenario: First month of operation
- **WHEN** `mrrLastMonth` is 0 and `mrrThisMonth` > 0
- **THEN** `mrrGrowthPct` is reported as `null` (displayed as "—", never as Infinity)

#### Scenario: MRR decreased
- **WHEN** `mrrThisMonth < mrrLastMonth`
- **THEN** `mrrGrowthPct` is negative and the dashboard shows a yellow warning banner

### Requirement: Churn proxy
The system SHALL compute weekly churn as `(pro+enterprise_count_last_week - pro+enterprise_count_this_week) / pro+enterprise_count_last_week` when the numerator is positive; otherwise 0.

#### Scenario: No churn
- **WHEN** paid sub count grew or stayed flat
- **THEN** churn is reported as 0%

### Requirement: Per-user LTV
The system SHALL compute user LTV as the sum of `PLAN_PRICE_USD[tier] × monthsActive` where `monthsActive` = floor((now − subscription.createdAt) / 30 days). Users without a paid subscription have LTV = 0.

#### Scenario: Pro subscriber for 6 months
- **WHEN** user has `tier=pro` for 6 full months
- **THEN** user LTV = 6 × 10 = $60

### Requirement: Total margin and burn-rate
The system SHALL compute this-month margin as `mrrThisMonth − sum(UsageLog.*CostUsd this calendar month)` and 30-day burn rate as the rolling 30-day sum of all `*CostUsd`.

#### Scenario: Revenue exceeds cost
- **WHEN** MRR = $300 and this-month API cost = $100
- **THEN** margin = $200 and margin% = 67%
- **AND** no warning banner triggers

#### Scenario: Margin drops below 70%
- **WHEN** this-month margin% < 70
- **THEN** a yellow threshold banner appears on admin dashboard
