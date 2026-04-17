## 1. Database & Schema

- [x] 1.1 Add UsageLog model to schema.prisma with fields: id, userId, projectId?, type, count, createdAt; indexes on (userId, createdAt) and (userId, type)
- [x] 1.2 Run `prisma migrate dev` to create migration
- [x] 1.3 Create backfill script (`web/scripts/backfill-usage.ts`) that counts LogoVersion per user and inserts UsageLog records

## 2. Auth — Admin Role Assignment

- [x] 2.1 Modify NextAuth callbacks in `web/src/lib/auth.ts` to auto-assign `role: "admin"` for `2000mageia@gmail.com` on sign-in
- [x] 2.2 Add admin role check to admin layout (`web/src/app/admin/layout.tsx`) — redirect non-admins to `/projects`

## 3. tRPC — Admin Router

- [x] 3.1 Create admin tRPC router (`web/src/server/routers/admin.ts`) with admin-only middleware
- [x] 3.2 Add `listUsers` procedure: paginated user list with project count, total generations (from UsageLog), subscription tier
- [x] 3.3 Add `getUserDetail` procedure: user info + projects with logos (include latest version thumbnail) + chat messages + usage stats
- [x] 3.4 Register admin router in `web/src/server/routers/_app.ts`

## 4. tRPC — Usage Router

- [x] 4.1 Create usage tRPC router (`web/src/server/routers/usage.ts`)
- [x] 4.2 Add `getMyUsageStats` procedure: total lifetime generations, today's count, remaining quota, tier
- [x] 4.3 Add `getDailyChart` procedure: daily generation counts for a given date range (7/30/90 days)
- [x] 4.4 Register usage router in `web/src/server/routers/_app.ts`

## 5. Generation Event Recording

- [x] 5.1 In `web/src/server/routers/generation.ts` `generateBatch`: add UsageLog.create after successful generation
- [x] 5.2 In `web/src/server/routers/generation.ts` `editLogo`: add UsageLog.create after successful edit
- [x] 5.3 In `web/src/app/api/chat/route.ts`: if chat route also triggers generations via tools, ensure UsageLog is recorded there too

## 6. Admin UI — User List Page

- [x] 6.1 Rewrite `web/src/app/admin/page.tsx` with user list table (search, pagination, columns: name, email, role, projects, generations, tier, joined)
- [x] 6.2 Keep existing subscription tier management as a section or modal within the admin page

## 7. Admin UI — User Detail Page

- [x] 7.1 Create `web/src/app/admin/users/[id]/page.tsx` with user info header, projects list with logo thumbnails, expandable chat history per project
- [x] 7.2 Admin guard covered by parent `/admin/layout.tsx` — no separate layout needed

## 8. User Dashboard — Usage Stats

- [x] 8.1 Install recharts: `pnpm add recharts`
- [x] 8.2 Create `web/src/components/usage-stats.tsx` component with stats card (total, today, remaining, tier) and daily bar chart with 7/30/90 day selector
- [x] 8.3 Integrate usage-stats component into `web/src/app/projects/page.tsx` at the top of the page

## 9. Verification

- [x] 9.1 TypeScript build passes (`pnpm build` in web/)
- [x] 9.2 Admin page loads with user list for admin users
- [x] 9.3 User detail page shows projects, logos, chats
- [x] 9.4 Usage chart renders on /projects page
- [x] 9.5 Non-admin users are redirected from /admin
