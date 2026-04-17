---
created: 2026-04-14T00:00:00Z
last_updated: 2026-04-14T00:00:00Z
type: nonspec
change_id: landing-redesign
status: pending
trigger: "Redesign landing page, add shared header/footer with auth state, create 4 new pages (/pricing, /about, /faq, /terms)"
---

# Plan: Landing Page Redesign + Shared Header/Footer + Auth State + New Pages

## Background & Research

### Design System Tokens (`.slash/design/system.md`)
- Palette: Monochromatic dark base + green accent (#4CAF50)
- Typography: Inter, H1=3rem bold tight, H2=2.25rem semibold, H3=1.5rem medium, Body=1rem 1.6lh
- Buttons: Primary=`--accent-green` text black, Secondary=transparent border `--border-secondary`, Ghost=transparent `--text-secondary`
- Cards: `--bg-secondary`, 1px border `--border-primary`, 12px radius, 24px padding
- Spacing: 4px base (micro 4/8, component 16/24, section 48/64/96)

### Current CSS Variables (`web/src/app/globals.css` lines 1-62)
```css
:root {
  --bg-primary: #0e0e0e;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #1e1e1e;
  --border-primary: #2a2a2a;
  --border-secondary: #333333;
  --text-primary: #ffffff;
  --text-secondary: #888888;
  --text-tertiary: #666666;
  --accent-green: #4CAF50;
  --accent-green-light: #81c784;
  --accent-orange: #ffb74d;
  --bg-deep: #0a0a0a;
  --text-muted: #444444;
  --text-dim: #555555;
  --accent-green-hover: #43A047;
  --accent-purple: #8888cc;
  --accent-yellow: #cccc66;
  --badge-purple-bg: #1e1e2e;
  --badge-green-bg: #1e2e1e;
  --badge-yellow-bg: #2e2e1e;
  --divider: #1f1f1f;
}
```

### Root Layout (`web/src/app/layout.tsx` lines 1-25)
```tsx
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "Splash", template: "%s | Splash" },
  description: "AI 채팅으로 로고를 디자인하세요 - Splash",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="dark">
      <body className={`${inter.className} bg-[#0e0e0e] text-white antialiased min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

### Providers (`web/src/app/providers.tsx` lines 1-32)
- Wraps children in `trpc.Provider` + `QueryClientProvider`
- Does NOT include `SessionProvider` from next-auth — session is accessed server-side via `auth()` and passed as props

### Auth Config (`web/src/lib/auth.ts` lines 1-36)
```tsx
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import { prisma } from "./prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [Google({...}), GitHub({...})],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) { if (user) { token.id = user.id } return token },
    session({ session, token }) { if (token?.id) { session.user.id = token.id as string } return session },
  },
  pages: { signIn: "/login" },
})
```

### Current Root Page (`web/src/app/page.tsx` lines 1-5)
```tsx
import { LandingPage } from "@/components/landing-page"

export default function Home() {
  return <LandingPage />
}
```

### Current Landing Page (`web/src/components/landing-page.tsx` — 221 lines)
- Client component (`"use client"`)
- Contains INLINE header (lines 60-76): Logo left, nav center (작동 방식/기능/요금제), login+CTA right
- Contains INLINE footer (lines 190-198): Simple copyright + 이용약관/개인정보처리방침 links
- NO auth awareness — always shows "로그인" and "무료로 시작하기"
- Uses hardcoded hex colors (`#0e0e0e`, `#2a2a2a`, `#4CAF50`, etc.) instead of CSS variables
- Contains `<style jsx global>` for fade-in animation
- Data arrays: `steps` (3 items), `features` (6 items), `pricing` (3 items)

### Projects Layout (`web/src/app/projects/layout.tsx` lines 1-10)
```tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) { redirect("/login") }
  return <>{children}</>
}
```
**CRITICAL**: No shared header in projects layout. Projects pages render their own headers internally. The shared header/footer MUST NOT appear in /projects or /admin routes.

### Login Page (`web/src/app/login/page.tsx` — 54 lines)
- Client component, only Google OAuth button, simple card layout
- Uses `signIn("google", { callbackUrl: "/projects" })` from `next-auth/react`

### Middleware (`web/src/middleware.ts` lines 1-22)
- Checks for `authjs.session-token` / `__Secure-authjs.session-token` cookies
- Redirects logged-in users from /login → /projects
- Matcher excludes `_next`, `favicon.ico`, `api`

### Key Architecture Decisions
1. **Header/Footer placement**: Cannot go in root `layout.tsx` because /projects and /admin should NOT have the public header. Must use a **public layout** wrapper or import the header in each public page.
   - **Recommended approach**: Create `web/src/app/(public)/layout.tsx` using a Next.js **route group** `(public)` that wraps `/`, `/pricing`, `/about`, `/faq`, `/terms` with shared header+footer. The `/login`, `/projects`, and `/admin` routes remain outside this group.
2. **Auth in header**: The `(public)/layout.tsx` is a server component — it can call `auth()` directly and pass session to client-side `<Header session={session} />`.
3. **No SessionProvider needed**: We pass session as a prop from server component to client component. This avoids adding SessionProvider to the entire app.
4. **Route group file moves**: `page.tsx` (home) must move from `web/src/app/page.tsx` to `web/src/app/(public)/page.tsx`. Similarly, login page stays at `web/src/app/login/page.tsx` (outside the group, no header/footer).

## Testing Plan (TDD — tests first)

> Note: This project has no existing test infrastructure or test files. The changes are purely frontend UI components with no complex logic. TDD is not practical here — the verification strategy is:

- [ ] TypeScript strict compilation passes (`tsc --noEmit`)
- [ ] Next.js production build succeeds (`pnpm build`)
- [ ] Visual verification: all pages render correctly at desktop and mobile breakpoints
- [ ] Auth state verification: logged-out sees "무료로 시작하기" CTA + "로그인" in header; logged-in sees "대시보드로 이동" CTA + user avatar dropdown in header
- [ ] Navigation: all header/footer links work, mobile hamburger menu opens/closes
- [ ] Route group doesn't break existing /projects and /admin routes (no header/footer appears there)

## Implementation Plan

### Phase 1: Foundation (CSS + Shared Components)

- [ ] **1.1** Add new CSS variables and utility classes to `web/src/app/globals.css`:
  - Add `--accent-red: #ef4444` for logout button
  - Add animation keyframes: `slideDown` (for mobile menu), `fadeInUp` (for sections)
  - Add `.fade-in-up` utility class (move from landing-page.tsx inline styles)
  - Add smooth scroll: `html { scroll-behavior: smooth; }`

- [ ] **1.2** Create `web/src/components/shared-header.tsx` (client component):
  - Props: `session: Session | null` (from next-auth)
  - Sticky header: 64px height, `--bg-primary` 80% opacity + backdrop-blur, 1px bottom border
  - Left: "Splash" logo link to `/`
  - Center (desktop): Nav links — "작동 방식" `/#how`, "기능" `/#features`, "요금제" `/pricing`
  - Right (logged out): "로그인" ghost link to `/login` + "무료로 시작하기" primary button link to `/login`
  - Right (logged in): "대시보드" ghost link to `/projects` + User avatar dropdown
  - User dropdown: avatar (or initial letter fallback), click opens popover with name/email, "대시보드로 이동" link, divider, "로그아웃" button (calls `signOut()` from `next-auth/react`)
  - Mobile: hamburger icon replaces center nav + right auth. Opens slide-down overlay with nav links and auth CTAs.
  - Close mobile menu on route change and Escape key

- [ ] **1.3** Create `web/src/components/shared-footer.tsx` (server component, no interactivity needed):
  - Background: `--bg-deep`, top border `--border-primary`, padding 64px 24px
  - 4-column layout (desktop), stacked (mobile):
    - Col 1: "Splash" logo + "AI 기반 로고 디자인 스튜디오" + © 2026 Splash
    - Col 2: 제품 — 작동 방식 `/#how`, 기능 `/#features`, 요금제 `/pricing`
    - Col 3: 회사 — 소개 `/about`, 연락처 `mailto:hello@usesplash.vercel.app`
    - Col 4: 지원 — FAQ `/faq`, 이용약관 `/terms`, 개인정보처리방침 `/terms`
  - Typography: headers 14px semibold `--text-primary`, links 14px `--text-secondary` hover `--text-primary`

- [ ] **1.4** Create route group `web/src/app/(public)/layout.tsx` (server component):
  - Import `auth` from `@/lib/auth`, call `const session = await auth()`
  - Import `SharedHeader` and `SharedFooter`
  - Render: `<SharedHeader session={session} />` + `{children}` + `<SharedFooter />`
  - This wraps all public pages with consistent header/footer

### Phase 2: Landing Page Redesign + Auth Fix

- [ ] **2.1** Move `web/src/app/page.tsx` to `web/src/app/(public)/page.tsx`:
  - Update to be a server component that calls `auth()` and passes session to `LandingPage`
  - Pass `session` prop: `<LandingPage session={session} />`

- [ ] **2.2** Rewrite `web/src/components/landing-page.tsx`:
  - Remove the inline `<header>` (lines 60-76) — now in SharedHeader
  - Remove the inline `<footer>` (lines 190-198) — now in SharedFooter
  - Remove `<style jsx global>` block — animations moved to globals.css
  - Accept `session` prop: `export function LandingPage({ session }: { session: Session | null })`
  - **Hero section** (redesigned per `landing-redesign.md`):
    - Centered layout (not 2-col), large confident headline: "AI와 대화하며 나만의 로고를 완성하세요"
    - Subheadline: "복잡한 디자인 툴 없이, 채팅만으로 전문가 수준의 로고를 만들어냅니다."
    - Auth-aware CTA: if `session` → "대시보드로 이동" linking to `/projects`, else → "무료로 시작하기" linking to `/login`
    - Below: animated mock UI grid or logo showcase (keep existing mock UI but polish)
  - **How It Works section** (3-col cards): Keep existing `steps` data, polish card styling to use CSS variables
  - **Features section** (2x3 grid): Keep existing `features` data, add hover border color change
  - **Pricing teaser** (3 cards, Pro highlighted): Keep existing `pricing` data, add "요금제 전체 보기" link to `/pricing`
  - **Final CTA section** (new): Centered — "지금 바로 당신의 브랜드를 시각화하세요" + auth-aware button
  - Replace ALL hardcoded hex colors with CSS variable references (`var(--bg-primary)`, etc.)
  - Use design system typography scale for headings

### Phase 3: New Pages (highly parallel)

- [ ] **3.1** Create `web/src/app/(public)/pricing/page.tsx` (server component):
  - Import metadata export: `export const metadata = { title: "요금제" }`
  - Hero: "당신에게 맞는 요금제를 선택하세요"
  - 3 pricing cards: Free / Pro / Enterprise
    - Pro highlighted with `--accent-green` border
    - Feature lists with checkmarks (✓ character or SVG)
    - CTAs: Free → `/login`, Pro → `mailto:`, Enterprise → `mailto:`
  - Detailed comparison table below cards
  - Billing FAQ accordion section
  - Use CSS variables throughout, design system card pattern

- [ ] **3.2** Create `web/src/app/(public)/about/page.tsx` (server component):
  - Import metadata: `export const metadata = { title: "소개" }`
  - Narrative single-column layout, max-width ~65ch
  - "왜 Splash를 만들었는가?" story section
  - Focus on democratization of design through AI
  - Clean typography: large pull quotes with left green border accent
  - Use H2, Body Large text styles from design system

- [ ] **3.3** Create `web/src/app/(public)/faq/page.tsx` (client component for accordion):
  - Two-column desktop: Left = sticky category nav, Right = accordion Q&A
  - Categories: 일반, 요금제, 로고 생성, 계정
  - Accordion with smooth height animation (CSS transition on max-height or grid-rows)
  - Each FAQ item: question (clickable, `--text-primary`) + answer (expandable, `--text-secondary`)
  - Mobile: categories become horizontal scroll tabs above Q&A

- [ ] **3.4** Create `web/src/app/(public)/terms/page.tsx` (client component for tabs):
  - Tabs at top: "이용약관" / "개인정보처리방침"
  - Document-style narrow layout (max-width 65ch)
  - Heavy use of H2, H3, body text, ordered lists
  - Tab switching with URL hash or state (no route change)
  - Typography: clean, readable, legal-document style

### Phase 4: Integration & Polish

- [ ] **4.1** Update `web/src/app/login/page.tsx`:
  - Ensure "← 홈으로" link still works (now `/` routes to `(public)/page.tsx`)
  - No header/footer on login page (stays outside route group — correct)

- [ ] **4.2** Verify `/projects` and `/admin` routes are unaffected:
  - Confirm no shared header/footer leaks into these routes
  - Confirm auth redirects still work

- [ ] **4.3** Run `tsc --noEmit` and `pnpm build` to verify no type errors or build failures

- [ ] **4.4** Final cleanup:
  - Remove any dead code from old landing page
  - Ensure all internal links use `<Link>` from next/link (not `<a>`)
  - Verify mobile responsiveness on all new pages

## Parallelization Plan

### Batch 1 (parallel) — Foundation
- [ ] **Coder A**: CSS + Footer → files: `web/src/app/globals.css`, `web/src/components/shared-footer.tsx` (new)
- [ ] **Coder B**: Header component → files: `web/src/components/shared-header.tsx` (new)

### Batch 2 (after Batch 1) — Layout + Landing
- [ ] **Coder C**: Route group layout + root page move + landing rewrite → files: `web/src/app/(public)/layout.tsx` (new), `web/src/app/(public)/page.tsx` (new, replaces old `web/src/app/page.tsx`), `web/src/components/landing-page.tsx`
  - Must delete or empty old `web/src/app/page.tsx` after creating `web/src/app/(public)/page.tsx`

### Batch 3 (after Batch 2, all parallel) — New Pages
- [ ] **Coder D**: Pricing page → files: `web/src/app/(public)/pricing/page.tsx` (new)
- [ ] **Coder E**: About page → files: `web/src/app/(public)/about/page.tsx` (new)
- [ ] **Coder F**: FAQ page → files: `web/src/app/(public)/faq/page.tsx` (new)
- [ ] **Coder G**: Terms page → files: `web/src/app/(public)/terms/page.tsx` (new)

### Batch 4 (after Batch 3) — Verification
- [ ] **Tester**: Run `tsc --noEmit && pnpm build` in `web/` directory. Fix any type errors.

### Dependencies
- Batch 1 first: Header and footer components must exist before the public layout can import them
- Batch 2 second: The `(public)/layout.tsx` imports header+footer, and the landing page rewrite removes inline header/footer (would break if done before shared components exist)
- Batch 3 after Batch 2: New pages live under `(public)/` route group, which must exist first. All 4 pages are independent — max parallelism.
- Batch 4 last: Verification after all code changes

### Risk Areas
1. **Route group migration**: Moving `page.tsx` from `app/` to `app/(public)/` changes the route resolution. Must delete or replace the old `app/page.tsx` to avoid conflict. Next.js does NOT allow both `app/page.tsx` and `app/(public)/page.tsx` to serve `/`.
2. **Auth in header**: `signOut()` from `next-auth/react` requires the component to be a client component. The header MUST be `"use client"`. The footer can be a server component.
3. **Session type**: Import `Session` type from `next-auth`. The session shape is `{ user: { id, email, name, image } }`.
4. **Mobile hamburger state**: Header needs `useState` for mobile menu open/close. Must handle body scroll lock when menu is open.
5. **Smooth scroll from other pages**: Links like `/pricing` page linking to `/#how` — the `#how` anchor only exists on the landing page. These cross-page anchor links will navigate to `/` first, then scroll.
6. **Login page isolation**: Login page at `web/src/app/login/page.tsx` is OUTSIDE the `(public)` route group — it won't get header/footer. This is intentional.

## Done Criteria
- [ ] All pages render: `/`, `/pricing`, `/about`, `/faq`, `/terms`
- [ ] Shared header visible on all 5 public pages with correct nav links
- [ ] Shared footer visible on all 5 public pages with correct column layout
- [ ] Logged-out state: header shows "로그인" + "무료로 시작하기", landing CTA shows "무료로 시작하기"
- [ ] Logged-in state: header shows "대시보드" + user avatar dropdown, landing CTA shows "대시보드로 이동"
- [ ] User dropdown: shows name/email, "대시보드로 이동" link, "로그아웃" button that works
- [ ] Mobile: hamburger menu works on all public pages
- [ ] `/projects` and `/admin` routes have NO shared header/footer
- [ ] `/login` page has NO shared header/footer
- [ ] `tsc --noEmit` passes
- [ ] `pnpm build` succeeds
- [ ] All CSS uses variables from globals.css, no hardcoded hex colors in new code
- [ ] Korean UI text throughout (no English placeholders)
