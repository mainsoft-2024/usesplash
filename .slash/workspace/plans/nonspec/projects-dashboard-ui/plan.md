---
created: 2026-04-14T00:00:00Z
last_updated: 2026-04-14T00:00:00Z
type: nonspec
change_id: projects-dashboard-ui
status: pending
trigger: "Improve projects dashboard page with logo thumbnail previews — gallery-style cards instead of plain text cards"
---

# Plan: Projects Dashboard UI Improvement with Logo Thumbnails

## Background & Research

### Design Spec
Design doc at `.slash/design/projects-dashboard.md` specifies:
- Gallery-style cards with 180px thumbnail area at top
- Thumbnail grid layouts: 0 logos (empty icon), 1 logo (full), 2 logos (50/50 split), 3+ logos (60/40 mosaic)
- Hover: border → `--accent-green`, images scale 1.05 inside overflow-hidden
- Metadata: project name (18px medium), description (14px line-clamp-1), stats line "N개의 로고 · N개의 버전 · YYYY.MM.DD"
- Improved empty state with dashed border and CTA button
- Delete button as trash icon, visible on hover only

### Design System Tokens (`.slash/design/system.md`)
- Colors: `--bg-primary` (#0e0e0e), `--bg-secondary`, `--border-primary`, `--accent-green`, `--text-secondary`, `--text-tertiary`
- Cards: `--bg-secondary`, 1px `--border-primary`, 12px radius (design doc upgrades to 16px for gallery cards)
- Buttons: Primary = `--accent-green` bg, Ghost = transparent bg
- Spacing base: 4px

### Current Project Router (`web/src/server/routers/project.ts`)
The `list` procedure already includes logos with version counts but strips the data:
```ts
// Lines 5-27
list: protectedProcedure.query(async ({ ctx }) => {
    const projects = await ctx.prisma.project.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { logos: true } },
        logos: {
          include: { _count: { select: { versions: true } } },
        },
      },
    })

    return projects.map((p) => ({
      ...p,
      logoCount: p._count.logos,
      revisionCount: p.logos.reduce(
        (sum, l) => sum + Math.max(0, l._count.versions - 1),
        0,
      ),
      logos: undefined,   // <-- strips logo data!
      _count: undefined,
    }))
  }),
```

**What needs to change:** Instead of `logos: undefined`, we need to return the latest 3 logo thumbnail URLs. We'll modify the Prisma include to also fetch the latest version's `imageUrl` per logo, ordered by `orderIndex`, take 3, and map to `thumbnails: string[]`.

### Current Projects Page (`web/src/app/projects/page.tsx`)
239-line client component with:
- tRPC query: `trpc.project.list.useQuery()` (line 15)
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5` (line 188)
- Cards: plain text with name, description, date badge, logo count badge, revision count badge (lines 190-231)
- Create modal (lines 57-124), Delete modal (lines 126-168)
- Empty state: minimal text only (lines 183-186)
- Loading: uses `<LoadingScreen />` from `@/components/spinners` (line 171)

**Full current card JSX (lines 190-231):**
```tsx
<div
  key={project.id}
  role="article"
  tabIndex={0}
  className="group relative cursor-pointer rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5 transition-all hover:border-[var(--accent-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-green)]"
  onClick={() => router.push(`/projects/${project.id}`)}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      router.push(`/projects/${project.id}`)
    }
  }}
>
  <button
    aria-label="프로젝트 삭제"
    onClick={(e) => {
      e.stopPropagation()
      setDeleteConfirm(project.id)
    }}
    className="absolute right-3 top-3 text-lg text-[var(--text-muted)] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
    title="삭제"
  >
    ×
  </button>
  <h3 className="mb-1 text-lg font-semibold">{project.name}</h3>
  {project.description && (
    <p className="mb-3 line-clamp-2 text-sm text-[var(--text-secondary)]">{project.description}</p>
  )}
  <div className="mt-3 flex gap-2">
    <span className="rounded-md bg-[var(--badge-purple-bg)] px-2 py-1 text-xs font-medium text-[var(--accent-purple)]">
      {new Date(project.createdAt).toLocaleDateString("ko")}
    </span>
    <span className="rounded-md bg-[var(--badge-green-bg)] px-2 py-1 text-xs font-medium text-[var(--accent-green-light)]">
      {project.logoCount} logos
    </span>
    {project.revisionCount > 0 && (
      <span className="rounded-md bg-[var(--badge-yellow-bg)] px-2 py-1 text-xs font-medium text-[var(--accent-yellow)]">
        {project.revisionCount} revisions
      </span>
    )}
  </div>
</div>
```

### Prisma Schema (relevant models)
```prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  userId      String
  logos       Logo[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Logo {
  id          String   @id @default(cuid())
  projectId   String
  orderIndex  Int
  versions    LogoVersion[]
}

model LogoVersion {
  id              String   @id @default(cuid())
  logoId          String
  versionNumber   Int
  imageUrl        String
  createdAt       DateTime @default(now())
}
```

### tRPC Client Import Pattern
```ts
import { trpc } from "@/lib/trpc/client"
// Usage: trpc.project.list.useQuery()
```

## Testing Plan (TDD — tests first)

> **Note:** This project does not currently have a test infrastructure set up (no test files, no vitest/jest config detected). Since this is a UI enhancement affecting only 2 files with straightforward data changes, we will rely on manual visual verification and TypeScript type checking rather than introducing a test framework for this change alone.

- [ ] **T1: Type-check router change** — After modifying the `list` procedure, run `npx tsc --noEmit` from `web/` to verify the return type is valid and the page component correctly consumes the new `thumbnails` field.
- [ ] **T2: Build verification** — Run `pnpm build` from `web/` to confirm no build errors with both router and page changes.
- [ ] **T3: Visual verification** — Start dev server (`pnpm dev`), navigate to `/projects`, and verify:
  - Projects with 0 logos show empty state icon in thumbnail area
  - Projects with 1 logo show single full-width thumbnail
  - Projects with 2 logos show 50/50 split layout
  - Projects with 3+ logos show mosaic layout (1 large + 2 small)
  - Hover animations work (border green, image scale)
  - Delete and create modals still function correctly
  - Empty state (0 projects) shows improved design with dashed border and CTA
  - Responsive grid works on mobile/tablet/desktop

## Implementation Plan

### Step 1: Modify tRPC project router to return thumbnail URLs

- [ ] **I1: Update Prisma include in `list` procedure** — In `web/src/server/routers/project.ts`, modify the `findMany` include to also fetch the latest LogoVersion `imageUrl` for each logo. Change the `logos` include to:
  ```ts
  logos: {
    orderBy: { orderIndex: "asc" },
    take: 3,
    include: {
      _count: { select: { versions: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { imageUrl: true },
      },
    },
  },
  ```

- [ ] **I2: Update return mapping to include `thumbnails`** — In the same `list` procedure, change the `return projects.map(...)` to extract thumbnail URLs and include them in the response:
  ```ts
  return projects.map((p) => ({
    ...p,
    logoCount: p._count.logos,
    revisionCount: p.logos.reduce(
      (sum, l) => sum + Math.max(0, l._count.versions - 1),
      0,
    ),
    thumbnails: p.logos
      .map((l) => l.versions[0]?.imageUrl)
      .filter((url): url is string => !!url),
    logos: undefined,
    _count: undefined,
  }))
  ```

### Step 2: Redesign the projects page UI

- [ ] **I3: Add `ThumbnailGrid` component** — Inside `web/src/app/projects/page.tsx`, add a local component (above `ProjectsPage`) that renders the thumbnail area based on the number of thumbnails:
  ```tsx
  function ThumbnailGrid({ thumbnails }: { thumbnails: string[] }) {
    const count = thumbnails.length
    if (count === 0) {
      // Empty state: dark bg with subtle icon
      return (
        <div className="flex h-[180px] items-center justify-center bg-[var(--bg-primary)]">
          <svg ...>{/* image/spark icon */}</svg>
        </div>
      )
    }
    if (count === 1) {
      return (
        <div className="h-[180px] overflow-hidden">
          <img src={thumbnails[0]} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        </div>
      )
    }
    if (count === 2) {
      return (
        <div className="grid h-[180px] grid-cols-2 gap-px overflow-hidden">
          {thumbnails.map((url, i) => (
            <img key={i} src={url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ))}
        </div>
      )
    }
    // 3+ logos: mosaic — 1 large left (60%), 2 small stacked right (40%)
    return (
      <div className="grid h-[180px] grid-cols-5 gap-px overflow-hidden">
        <div className="col-span-3 overflow-hidden">
          <img src={thumbnails[0]} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        </div>
        <div className="col-span-2 grid grid-rows-2 gap-px overflow-hidden">
          {thumbnails.slice(1, 3).map((url, i) => (
            <img key={i} src={url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ))}
        </div>
      </div>
    )
  }
  ```

- [ ] **I4: Redesign project card structure** — Replace the current card JSX (lines 190-231) with the new gallery card design:
  - Card container: `rounded-2xl` (keep), add `overflow-hidden`, remove `p-5` (padding moves to metadata area only)
  - Top section: `<ThumbnailGrid thumbnails={project.thumbnails} />`
  - Bottom section: new `div` with `p-5` containing:
    - Flex row: project name (18px, medium weight, truncate) + delete button (trash icon, ghost style, opacity-0 group-hover:opacity-100)
    - Description (14px, `--text-secondary`, line-clamp-1, conditional)
    - Stats line: `<p className="text-xs text-[var(--text-tertiary)]">{project.logoCount}개의 로고 · {project.revisionCount}개의 버전 · {date}</p>`
  - Keep existing: `role="article"`, `tabIndex={0}`, `onClick`, `onKeyDown`, `group` class, hover border

- [ ] **I5: Redesign empty state (0 projects)** — Replace lines 183-186 with an improved empty state:
  ```tsx
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-primary)] bg-[var(--bg-secondary)] py-20">
    <svg ...>{/* minimal icon */}</svg>
    <p className="mt-4 text-lg text-[var(--text-secondary)]">아직 프로젝트가 없습니다</p>
    <p className="mt-1 text-sm text-[var(--text-tertiary)]">새 프로젝트를 만들어 로고 디자인을 시작하세요</p>
    <button
      onClick={() => setShowNew(true)}
      className="mt-6 rounded-lg bg-[var(--accent-green)] px-4 py-2 font-medium text-white hover:bg-[var(--accent-green-hover)]"
    >
      + 새 프로젝트
    </button>
  </div>
  ```

- [ ] **I6: Update stats format to Korean** — Change badge-based stats to a single text line: `{project.logoCount}개의 로고 · {project.revisionCount}개의 버전 · {date}` — using `text-xs text-[var(--text-tertiary)]` per design doc.

### Step 3: Polish and verify

- [ ] **I7: Add image loading graceful fade-in** — Add a simple CSS animation or `onLoad` opacity transition to thumbnail images so they don't flash in:
  ```css
  /* Inline via Tailwind: opacity-0 transition-opacity duration-300 onLoad → opacity-100 */
  ```
  Implement via a small `useState` + `onLoad` handler or a CSS-only `@keyframes fadeIn` approach.

- [ ] **I8: Run TypeScript check and build** — Execute `npx tsc --noEmit && pnpm build` from `web/` to verify everything compiles.

## Parallelization Plan

### Batch 1 (sequential — router first, then page)
- [ ] **Coder A: Backend** → files: `web/src/server/routers/project.ts`
  - Tasks: I1, I2
  - Modify the `list` procedure to include `thumbnails: string[]` in the return type

### Batch 2 (after Batch 1 — page depends on new return type)
- [ ] **Coder B: Frontend** → files: `web/src/app/projects/page.tsx`
  - Tasks: I3, I4, I5, I6, I7
  - Add `ThumbnailGrid` component, redesign cards, improve empty state, add fade-in

### Batch 3 (after Batch 2)
- [ ] **Verification** → no file changes
  - Tasks: T1, T2, T3 (type-check, build, visual verification)

### Dependencies
- Batch 2 depends on Batch 1 because the page component needs the new `thumbnails` field from the router's return type — TypeScript will error if the field doesn't exist yet.
- Batch 3 depends on Batch 2 because we need both changes in place to verify.

### Risk Areas
- **Image loading performance**: Vercel Blob URLs are direct CDN links, so they should load fast. But if a user has many projects with many logos, the page could be image-heavy. Consider adding `loading="lazy"` to thumbnail `<img>` tags.
- **Type inference**: tRPC infers return types automatically. After changing the router, the client type should update automatically via the `AppRouter` type. No manual type definitions needed.
- **Empty thumbnails array**: A project could have logos but no versions yet (edge case during generation). The `filter(Boolean)` in I2 handles this — `thumbnails` may have fewer items than `logoCount`.

## Done Criteria
- [ ] tRPC `project.list` returns `thumbnails: string[]` (up to 3 URLs) for each project
- [ ] Project cards show thumbnail gallery with correct layout for 0/1/2/3+ logos
- [ ] Hover state: border turns green, images scale slightly
- [ ] Stats displayed as Korean text line (not badges): "N개의 로고 · N개의 버전 · YYYY.MM.DD"
- [ ] Empty state (0 projects) has dashed border, icon, and CTA button
- [ ] Delete and create modals continue to work correctly
- [ ] TypeScript compiles without errors (`tsc --noEmit`)
- [ ] Next.js build succeeds (`pnpm build`)
- [ ] Responsive layout works across mobile/tablet/desktop breakpoints
