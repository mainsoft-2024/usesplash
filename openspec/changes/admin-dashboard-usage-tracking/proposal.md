## Why

The platform has no visibility into user activity. Admins cannot see what users have created or how much they're using the service. Users themselves have no way to track their own generation usage over time. The existing admin page only handles subscription tier changes — it needs full user management capabilities.

## What Changes

- **Enhanced admin dashboard** (`/admin`): User list table with search, showing all users, their projects, logos, chat history, and usage stats
- **Admin user detail page** (`/admin/users/[id]`): Deep dive into a specific user's projects, logo thumbnails, chat messages, and generation history
- **UsageLog table**: New database model to record every image generation event with timestamp, enabling historical tracking and daily aggregation
- **Backfill script**: One-time migration to count existing LogoVersion records per user and populate UsageLog with historical data
- **User usage dashboard**: Usage stats card at the top of `/projects` page showing total generations, today's usage, remaining quota, and a daily usage chart (7/30/90 day selectable range) using recharts
- **Auto-assign admin role**: `2000mageia@gmail.com` gets `role: "admin"` on login
- **Admin role guard**: Admin pages check `role === "admin"` server-side

## Capabilities

### New Capabilities
- `admin-user-management`: Admin dashboard with user list, user detail pages, project/logo/chat viewing per user
- `usage-tracking`: UsageLog model, generation event recording, backfill migration, daily aggregation queries
- `user-usage-dashboard`: User-facing usage stats card with recharts daily chart on /projects page

### Modified Capabilities
- `subscription`: Record generation events to UsageLog alongside existing dailyGenerations counter
- `auth`: Auto-assign admin role for whitelisted email on Google OAuth login

## Impact

- **Database**: New `UsageLog` model + migration; new index on User.role
- **Dependencies**: `recharts` package added to web/
- **API**: New tRPC procedures in admin router (listUsers, getUserDetail, getUsageStats) and usage router (getUserUsage, getDailyChart)
- **Auth**: NextAuth callback modified to set admin role for specific email
- **Pages**: New `/admin/users/[id]` page; enhanced `/admin` page; modified `/projects` page with usage card
