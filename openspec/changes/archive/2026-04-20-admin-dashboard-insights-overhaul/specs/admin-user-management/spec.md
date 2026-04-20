## MODIFIED Requirements

### Requirement: Admin user list page
The `/admin` 사용자 탭 SHALL list all users in a paginated sortable table with columns: `Name, Email, Tier, Projects, Generations, 누적 비용 (USD), LTV (USD), Margin (USD), Signup date, Actions`. The existing tier-change dropdown SHALL remain in the Actions column.

New filter controls SHALL be provided: `tier multi-select`, `활성도 (active/inactive in last 7 days)`, `signup date range`, plus existing text search.

A `CSV 내보내기` button SHALL download the currently filtered rows as CSV.

#### Scenario: Sort by margin descending
- **WHEN** admin clicks the Margin column header
- **THEN** rows re-order from highest margin to lowest

#### Scenario: Filter to pro inactive users
- **WHEN** admin selects tier=pro and 활성도=inactive
- **THEN** only pro users with 0 UsageLog events in last 7 days are shown

#### Scenario: Export current view
- **WHEN** admin clicks CSV 내보내기 after applying filters
- **THEN** a CSV downloads with exactly the filtered rows and all listed columns

### Requirement: Admin user detail page enhancements
The `/admin/users/[id]` page SHALL, in addition to existing project/logo/chat content, display a "수익 & 비용" panel at the top showing: `현재 구독 월 금액 (USD)`, `누적 구독금액 (LTV, USD)`, `누적 API 비용 (USD)`, `단일 사용자 마진 (LTV − 누적 비용, USD)`.

#### Scenario: Pro user with 3 months tenure and $7 API spend
- **WHEN** admin opens the detail page
- **THEN** the panel shows `$10/mo, LTV $30, Cost $7, Margin $23`

#### Scenario: Free user who never paid
- **WHEN** admin opens the detail page
- **THEN** the panel shows `$0/mo, LTV $0, Cost (their API cost), Margin (negative of cost)`

#### Scenario: Panel uses same period selector as main dashboard
- **WHEN** admin has 30일 selected on main dashboard and clicks into a user
- **THEN** the API cost number shows last 30 days by default, but LTV is always lifetime
