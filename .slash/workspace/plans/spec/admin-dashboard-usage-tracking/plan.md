---
created: 2026-04-14T00:00:00Z
last_updated: 2026-04-14T00:00:00Z
type: spec
change_id: admin-dashboard-usage-tracking
status: pending
trigger: "Admin dashboard with user management, usage tracking (UsageLog model), backfill script, and user-facing usage stats with recharts chart"
---

# Plan: Admin Dashboard & Usage Tracking

## Background & Research

### Prisma Schema (current state)
- File: `web/prisma/schema.prisma`
- User model already has `role String @default("user")` — ready for admin checks
- Subscription model has `dailyGenerations Int @default(0)` and `dailyResetAt` — this resets daily, no historical data
- LogoVersion model tracks all generated/edited images — can be counted for backfill
- No `UsageLog` model exists yet

Key schema excerpt:
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  role          String    @default("user")
  projects      Project[]
  subscription  Subscription?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Subscription {
  id               String   @id @default(cuid())
  userId           String   @unique
  tier             String   @default("free")
  dailyGenerations Int      @default(0)
  dailyResetAt     DateTime @default(now())
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model LogoVersion {
  id              String   @id @default(cuid())
  logoId          String
  versionNumber   Int
  parentVersionId String?
  imageUrl        String
  s3Key           String
  editPrompt      String?  @db.Text
  logo            Logo     @relation(fields: [logoId], references: [id], onDelete: Cascade)
  chatMessageId   String?
  createdAt       DateTime @default(now())
}
```

### Auth Config
- File: `web/src/lib/auth.ts`
- NextAuth v5 with JWT strategy, PrismaAdapter, Google + GitHub providers
- Current callbacks only inject `user.id` into JWT/session — no role injection
```typescript
callbacks: {
  jwt({ token, user }) {
    if (user) {
      token.id = user.id
    }
    return token
  },
  session({ session, token }) {
    if (token?.id) {
      session.user.id = token.id as string
    }
    return session
  },
},
```

### tRPC Server Setup
- File: `web/src/lib/trpc/server.ts`
- Exports: `router`, `publicProcedure`, `protectedProcedure`
- `protectedProcedure` checks `ctx.session?.user` — no role checks
- Context provides `{ session, prisma }`
```typescript
export const createTRPCContext = async () => {
  const session = await auth()
  return { session, prisma }
}

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
    },
  })
})
```

### Router Composition
- File: `web/src/server/routers/_app.ts`
- 6 routers: project, logo, chat, generation, export, subscription
```typescript
export const appRouter = router({
  project: projectRouter,
  logo: logoRouter,
  chat: chatRouter,
  generation: generationRouter,
  export: exportRouter,
  subscription: subscriptionRouter,
})
```

### tRPC Client
- File: `web/src/lib/trpc/client.ts`
```typescript
import { createTRPCReact } from "@trpc/react-query"
import type { AppRouter } from "@/server/routers/_app"
export const trpc = createTRPCReact<AppRouter>()
```

### Generation Usage Points (4 locations to add UsageLog)

**1. `web/src/server/routers/generation.ts` — `generateBatch` (lines 89-96)**
```typescript
// Update usage
if (generatedLogos.length > 0) {
  await ctx.prisma.subscription.upsert({
    where: { userId },
    update: { dailyGenerations: { increment: generatedLogos.length } },
    create: { userId, dailyGenerations: generatedLogos.length },
  })
}
```

**2. `web/src/server/routers/generation.ts` — `editLogo` (lines 156-161)**
```typescript
// Update usage
await ctx.prisma.subscription.upsert({
  where: { userId },
  update: { dailyGenerations: { increment: 1 } },
  create: { userId, dailyGenerations: 1 },
})
```

**3. `web/src/app/api/chat/route.ts` — `generate_batch` tool (lines 129-136)**
```typescript
// Update usage
if (logos.length > 0) {
  await prisma.subscription.upsert({
    where: { userId },
    update: { dailyGenerations: { increment: logos.length } },
    create: { userId, dailyGenerations: logos.length },
  })
}
```

**4. `web/src/app/api/chat/route.ts` — `edit_logo` tool (lines 225-230)**
```typescript
// Update usage
await prisma.subscription.upsert({
  where: { userId },
  update: { dailyGenerations: { increment: 1 } },
  create: { userId, dailyGenerations: 1 },
})
```

### Existing Admin Page
- File: `web/src/app/admin/page.tsx` — client component with subscription tier management UI
- File: `web/src/app/admin/layout.tsx` — checks `session?.user` but does NOT check admin role
```typescript
// layout.tsx — only checks login, not role
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  return <>{children}</>
}
```

### Subscription Router
- File: `web/src/server/routers/subscription.ts`
- `adminUpdateTier` already does manual role check: `if (user?.role !== "admin")`
- Exports `TIER_LIMITS` constant: `{ free: { dailyGenerations: 10 }, pro: { dailyGenerations: 100 }, enterprise: { dailyGenerations: -1 } }`
```typescript
const TIER_LIMITS = {
  free: { maxProjects: 3, dailyGenerations: 10, premiumExport: false },
  pro: { maxProjects: -1, dailyGenerations: 100, premiumExport: true },
  enterprise: { maxProjects: -1, dailyGenerations: -1, premiumExport: true },
} as const
```

### Projects Page Structure
- File: `web/src/app/projects/page.tsx` (340 lines, client component)
- Page layout: header (logo + "새 프로젝트" button) → project grid
- Usage stats card should be inserted between header and project grid (after line 131, before line 133)
```tsx
// lines 115-131 — header section
return (
  <div className="min-h-screen p-8">
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/" className="text-3xl font-bold hover:opacity-90">
            Sp<span className="text-[var(--accent-green)]">lash</span>
          </Link>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">AI 로고 디자인 프로젝트</p>
        </div>
        <button onClick={() => setShowNew(true)} ...>+ 새 프로젝트</button>
      </div>
      {/* ← INSERT USAGE STATS CARD HERE */}
      {showNew && ( /* modal */ )}
```

### UI Design Patterns (from existing components)
- Card: `rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6`
- Button primary: `rounded-lg bg-[var(--accent-green)] px-4 py-2 font-medium text-white hover:bg-[var(--accent-green-hover)]`
- Input: `rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-4 py-3 text-white focus:border-[var(--accent-green)] focus:outline-none`
- Table: dark theme with `bg-[var(--bg-secondary)]` rows, `border-[var(--border-primary)]` dividers
- Modal: `fixed inset-0 z-50 flex animate-[fadeIn_150ms_ease-out] items-center justify-center bg-black/60`
- Colors: `--accent-green: #4CAF50`, `--bg-primary: #0e0e0e`, `--bg-secondary: #1a1a1a`
- Language: Korean for UI labels

### Dependencies
- `recharts` — already installed by mad-agent (`pnpm add recharts`)

---

## Implementation Plan

### Phase 1: Schema & Migration

- [ ] 1.1 Add `UsageLog` model to `web/prisma/schema.prisma`:
  ```prisma
  model UsageLog {
    id        String   @id @default(cuid())
    userId    String
    projectId String?
    type      String   // "generate" | "edit"
    count     Int      @default(1)
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
    createdAt DateTime @default(now())
    @@index([userId, createdAt])
    @@index([userId, type])
  }
  ```
- [ ] 1.2 Add `usageLogs UsageLog[]` relation field to `User` model
- [ ] 1.3 Add `usageLogs UsageLog[]` relation field to `Project` model
- [ ] 1.4 Run `npx prisma migrate dev --name add-usage-log` from `web/` directory
- [ ] 1.5 Verify generated Prisma client includes `UsageLog` type

### Phase 2: Auth — Admin Role Auto-Assignment

- [ ] 2.1 Modify `web/src/lib/auth.ts` JWT callback to: (a) look up user role from DB, (b) if email is `2000mageia@gmail.com` and role is not admin, update DB to set `role: "admin"`, (c) inject `role` into JWT token
- [ ] 2.2 Modify `web/src/lib/auth.ts` session callback to inject `token.role` into `session.user.role`
- [ ] 2.3 Add TypeScript type augmentation for `next-auth` to include `role` on `Session.user` and `JWT` (can be in `web/src/types/next-auth.d.ts` or inline in auth.ts)
- [ ] 2.4 Update `web/src/app/admin/layout.tsx` to check `session.user.role === "admin"` and redirect non-admins to `/projects` (instead of only checking login)

### Phase 3: tRPC — Admin Router

- [ ] 3.1 Create `web/src/server/routers/admin.ts` with `adminProcedure` middleware that extends `protectedProcedure` and checks `ctx.session.user.role === "admin"`, throws `FORBIDDEN` if not
- [ ] 3.2 Add `listUsers` procedure: paginated query with search (name/email `contains` filter, insensitive), returns users with `_count` of projects, aggregated UsageLog count, subscription tier, joined date. Input: `{ page, pageSize, search? }`
- [ ] 3.3 Add `getUserDetail` procedure: single user by ID with projects (include logos with latest version thumbnail), chat messages grouped by project, usage stats (total from UsageLog, today's count). Input: `{ userId }`
- [ ] 3.4 Register `adminRouter` in `web/src/server/routers/_app.ts`: add `import { adminRouter } from "./admin"` and `admin: adminRouter` to the router composition

### Phase 4: tRPC — Usage Router

- [ ] 4.1 Create `web/src/server/routers/usage.ts` using `protectedProcedure`
- [ ] 4.2 Add `getMyUsageStats` procedure: queries UsageLog for current user's total lifetime count (`_count` or `_sum`), today's count (where `createdAt >= today midnight UTC`), reads subscription for tier/dailyLimit, computes remaining. Returns `{ total, today, remaining, tier, dailyLimit }`
- [ ] 4.3 Add `getDailyChart` procedure: input `{ days: 7 | 30 | 90 }`, queries UsageLog grouped by date for current user over that range, fills in zero-count days, returns `Array<{ date: string, count: number }>`
- [ ] 4.4 Register `usageRouter` in `web/src/server/routers/_app.ts`: add `import { usageRouter } from "./usage"` and `usage: usageRouter`

### Phase 5: Generation Event Recording (UsageLog)

- [ ] 5.1 In `web/src/server/routers/generation.ts` `generateBatch`: after the subscription upsert (line 91-96), add `ctx.prisma.usageLog.create({ data: { userId, projectId: input.projectId, type: "generate", count: generatedLogos.length } })`
- [ ] 5.2 In `web/src/server/routers/generation.ts` `editLogo`: after the subscription upsert (line 157-161), add `ctx.prisma.usageLog.create({ data: { userId, projectId: sourceVersion.logo.projectId, type: "edit", count: 1 } })`
- [ ] 5.3 In `web/src/app/api/chat/route.ts` `generate_batch` tool: after the subscription upsert (line 131-136), add `prisma.usageLog.create({ data: { userId, projectId, type: "generate", count: logos.length } })`
- [ ] 5.4 In `web/src/app/api/chat/route.ts` `edit_logo` tool: after the subscription upsert (line 226-230), add `prisma.usageLog.create({ data: { userId, projectId, type: "edit", count: 1 } })`

### Phase 6: Backfill Script

- [ ] 6.1 Create `web/scripts/backfill-usage.ts` that:
  - Imports Prisma client
  - Queries all LogoVersions grouped by `logo.project.userId` with count
  - For each user, creates a single UsageLog entry with `type: "generate"`, `count: totalVersions`, `createdAt: earliest LogoVersion date` (to distinguish backfill from real-time)
  - Logs progress to console
- [ ] 6.2 Add `"backfill-usage"` script to `web/package.json`: `"backfill-usage": "npx tsx scripts/backfill-usage.ts"`

### Phase 7: Admin UI — User List Page

- [ ] 7.1 Rewrite `web/src/app/admin/page.tsx` as a client component with:
  - Search input field (debounced, 300ms)
  - Paginated user table: columns = Name, Email, Role, Projects, Generations, Tier, Joined
  - Each row links to `/admin/users/[id]`
  - Pagination controls (prev/next buttons, page number display)
  - Uses `trpc.admin.listUsers.useQuery({ page, pageSize: 20, search })`
  - Keep existing subscription tier management as a collapsible section or separate tab at the bottom

### Phase 8: Admin UI — User Detail Page

- [ ] 8.1 Create `web/src/app/admin/users/[id]/page.tsx` as a client component with:
  - User info header: avatar/initial, name, email, role badge, tier badge, joined date, total generations
  - Projects section: list of project cards with name, description, logo thumbnails (grid of latest version images), creation date
  - Chat history: expandable/collapsible per project, shows chat messages in chronological order (role + content)
  - Uses `trpc.admin.getUserDetail.useQuery({ userId: params.id })`
- [ ] 8.2 The admin layout (`web/src/app/admin/layout.tsx`) already covers auth guard for this nested route — no separate layout needed for `/admin/users/[id]`

### Phase 9: User Dashboard — Usage Stats Component

- [ ] 9.1 Create `web/src/components/usage-stats.tsx` as a client component with:
  - Stats card row: 4 stat boxes in a responsive grid (`grid-cols-2 lg:grid-cols-4`)
    - Total Generations (lifetime count, accent green number)
    - Today's Usage (today count / daily limit)
    - Remaining (remaining count with progress bar)
    - Tier (badge with tier name)
  - Daily bar chart below stats using `recharts` `BarChart` + `Bar` + `XAxis` + `YAxis` + `Tooltip` + `ResponsiveContainer`
  - Date range selector: 3 buttons (7일 / 30일 / 90일) with active state
  - Uses `trpc.usage.getMyUsageStats.useQuery()` and `trpc.usage.getDailyChart.useQuery({ days })`
  - Loading state: skeleton placeholders
  - Follow existing dark theme: `bg-[var(--bg-secondary)]`, green accents, rounded-2xl cards
- [ ] 9.2 Integrate `<UsageStats />` component into `web/src/app/projects/page.tsx`: insert after the header section (after the `</div>` closing the flex header at line 131) and before the modals/project grid, wrapped in `<div className="mb-8">`

### Phase 10: Verification

- [ ] 10.1 Run `pnpm build` in `web/` — must pass TypeScript compilation and Next.js build
- [ ] 10.2 Verify admin page loads at `/admin` for admin user (shows user list)
- [ ] 10.3 Verify non-admin users are redirected from `/admin` to `/projects`
- [ ] 10.4 Verify user detail page at `/admin/users/[id]` shows projects, logos, chats
- [ ] 10.5 Verify usage chart renders on `/projects` page with stats card and recharts bar chart
- [ ] 10.6 Verify generation events create UsageLog entries (test via generating a logo)

---

## Parallelization Plan

### Batch 1 (sequential — must complete first)
- [ ] Coder A: Phase 1 (Schema & Migration) → files: `web/prisma/schema.prisma`
  - Run `prisma migrate dev` after schema changes

### Batch 2 (parallel — after Batch 1 completes)
- [ ] Coder A: Phase 2 (Auth) + Phase 3 (Admin Router) → files: `web/src/lib/auth.ts`, `web/src/types/next-auth.d.ts`, `web/src/server/routers/admin.ts`, `web/src/app/admin/layout.tsx`
- [ ] Coder B: Phase 4 (Usage Router) + Phase 5 (Generation Event Recording) → files: `web/src/server/routers/usage.ts`, `web/src/server/routers/generation.ts`, `web/src/app/api/chat/route.ts`
- [ ] Coder C: Phase 6 (Backfill Script) → files: `web/scripts/backfill-usage.ts`, `web/package.json`

### Batch 3 (sequential — register routers, after Batch 2)
- [ ] Coder A: Phase 3.4 + Phase 4.4 (Register admin + usage routers in _app.ts) → files: `web/src/server/routers/_app.ts`

### Batch 4 (parallel — UI, after Batch 3 completes)
- [ ] Coder A: Phase 7 (Admin User List Page) → files: `web/src/app/admin/page.tsx`
- [ ] Coder B: Phase 8 (Admin User Detail Page) → files: `web/src/app/admin/users/[id]/page.tsx`
- [ ] Coder C: Phase 9 (Usage Stats Component + Integration) → files: `web/src/components/usage-stats.tsx`, `web/src/app/projects/page.tsx`

### Batch 5 (sequential — verification)
- [ ] Coder A: Phase 10 (Build verification) → read-only verification

### Dependencies
- **Batch 1 → Batch 2**: All routers and scripts need the UsageLog model in the generated Prisma client
- **Batch 2 → Batch 3**: Router registration needs the router files to exist first
- **Batch 3 → Batch 4**: UI components call tRPC procedures that must be registered in `_app.ts`
- **_app.ts is a bottleneck**: Only one coder can touch it (Batch 3). Both admin and usage router imports go in one edit.

### Risk Areas
- **`_app.ts` merge conflict**: Both admin and usage routers register here. Handled by doing both in Batch 3 with a single coder.
- **`generation.ts` + `route.ts` shared pattern**: Both need the same UsageLog.create pattern but are different files — safe to edit in same batch by same coder.
- **Auth type augmentation**: `next-auth` module augmentation must be done before admin router can type-check `session.user.role`. Coder A handles both in Batch 2.
- **Recharts SSR**: `recharts` uses client-side rendering. The `usage-stats.tsx` component must have `"use client"` directive. Since `projects/page.tsx` is already a client component, no issues.
- **Prisma 7 adapter**: Uses `PrismaPg` adapter. The `prisma.usageLog.create()` calls work the same as other models — no special handling needed.

---

## Done Criteria
- [ ] `UsageLog` model exists in Prisma schema with correct indexes
- [ ] Migration applied successfully
- [ ] Admin email auto-assigned admin role on login
- [ ] Admin layout blocks non-admin users (redirect to /projects)
- [ ] `trpc.admin.listUsers` returns paginated user list with search
- [ ] `trpc.admin.getUserDetail` returns full user activity data
- [ ] `trpc.usage.getMyUsageStats` returns lifetime/today/remaining stats
- [ ] `trpc.usage.getDailyChart` returns daily counts for 7/30/90 days
- [ ] All 4 generation points create UsageLog entries
- [ ] Backfill script exists and can populate historical data
- [ ] Admin page shows user list table with search and pagination
- [ ] User detail page shows projects, logos, and chat history
- [ ] Usage stats card with recharts bar chart appears on /projects page
- [ ] `pnpm build` passes cleanly
- [ ] OpenSpec tasks checked: tasks.md items 1.1–9.5
