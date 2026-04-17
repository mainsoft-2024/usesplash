## Context

Splash is an AI logo design SaaS with a Next.js 15 + tRPC + Prisma 7 stack. Current admin page (`/admin`) only supports subscription tier changes via manual user ID input. There is no user listing, no activity visibility, and no historical usage tracking. The `Subscription.dailyGenerations` field resets daily and provides no cumulative data.

## Goals / Non-Goals

**Goals:**
- Admin can browse all users, drill into their projects/logos/chats
- Every image generation event is recorded with timestamp for historical analysis
- Users see their own usage stats with daily chart on their dashboard
- Existing generation history is backfilled from LogoVersion records

**Non-Goals:**
- Real-time analytics or streaming metrics
- Admin CRUD operations on user content (delete/edit logos, messages)
- Billing integration or payment tracking
- Export usage reports to CSV/PDF

## Decisions

### 1. UsageLog model (not counters on User/Subscription)
**Choice**: Separate `UsageLog` table with one row per generation event.
**Why**: Enables daily aggregation, date-range queries, and future per-project breakdowns. A simple counter field loses temporal granularity.
**Alternative**: `totalGenerations` counter on Subscription — simpler but can't produce daily charts.

### 2. Recharts for charts
**Choice**: `recharts` library for the daily usage bar chart.
**Why**: User preference. Well-maintained React charting library with good SSR compat.
**Alternative**: Pure CSS bars — lighter but limited interactivity.

### 3. Admin routing: `/admin` list + `/admin/users/[id]` detail
**Choice**: Two-page structure with server-side role check.
**Why**: Clean separation. List page stays fast (paginated). Detail page loads full user data.
**Alternative**: Single-page accordion — cluttered with many users.

### 4. Admin role assignment via NextAuth callback
**Choice**: In the `signIn` or `jwt` callback, check email against whitelist and set `role: "admin"`.
**Why**: Simple, no separate migration needed. Admin email is `2000mageia@gmail.com`.
**Alternative**: Manual DB update — error-prone, not self-service.

### 5. Backfill via Prisma migration seed / standalone script
**Choice**: A standalone script that groups LogoVersion by user and inserts UsageLog rows.
**Why**: One-time operation. Keep it separate from migration files for clarity.

### 6. tRPC admin router with role middleware
**Choice**: New `adminRouter` with a reusable admin-only middleware that checks `user.role === "admin"`.
**Why**: Centralizes auth check. All admin procedures inherit it.

## Risks / Trade-offs

- **[UsageLog table growth]** → Each generation adds a row. At current scale this is negligible. Add index on `(userId, createdAt)` for efficient range queries.
- **[Backfill accuracy]** → LogoVersion count approximates generations (failed attempts aren't in DB). Acceptable since failed gens don't produce versions.
- **[Admin email hardcoded]** → For now only one admin. If more needed, extend to an array in env var. Good enough for MVP.
- **[Recharts bundle size]** → ~40KB gzipped. Acceptable for the /projects page which is already a heavy client page.

## Migration Plan

1. Create `UsageLog` model + Prisma migration
2. Run backfill script to populate historical data
3. Deploy backend changes (new tRPC routers, auth callback)
4. Deploy frontend changes (admin pages, usage dashboard)
5. Rollback: Drop `UsageLog` table, revert code. No data loss risk since it's additive.
