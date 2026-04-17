## ADDED Requirements

### Requirement: Usage stats card on projects page
The system SHALL display a usage stats card at the top of `/projects` showing: total lifetime generations, today's generation count, remaining daily quota, and subscription tier.

#### Scenario: User sees usage summary
- **WHEN** a user navigates to `/projects`
- **THEN** the page shows a card with total generations, today's count, remaining quota, and tier badge

### Requirement: Daily usage chart
The system SHALL display a bar chart (recharts) showing daily generation counts. The user SHALL be able to select date ranges: 7, 30, or 90 days.

#### Scenario: User views 30-day chart
- **WHEN** a user selects "30 days" on the usage chart
- **THEN** the chart displays a bar for each of the last 30 days with generation counts

#### Scenario: User switches to 7-day view
- **WHEN** a user clicks "7 days"
- **THEN** the chart updates to show only the last 7 days

#### Scenario: Days with no generations show zero
- **WHEN** a day has no generation events
- **THEN** the chart shows a bar with height 0 for that day
