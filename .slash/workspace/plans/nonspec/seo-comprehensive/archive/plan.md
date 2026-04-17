---
created: 2026-04-14T00:00:00Z
last_updated: 2026-04-14T00:00:00Z
type: nonspec
change_id: seo-comprehensive
status: done
trigger: "사용자가 Next.js 앱에 SEO 관련 모든 작업을 파악해서 전부 적용해달라고 요청"
---

# Plan: Comprehensive SEO Implementation for Splash

## Background & Research

**Research file:** `.slash/workspace/research/nonspec-seo-nextjs15.md`

### Current Root Layout (`web/src/app/layout.tsx`, 26 lines)
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

### Current next.config.ts (`web/next.config.ts`, 8 lines)
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

### Landing Page (`web/src/app/(public)/page.tsx`, 8 lines) — Server component, NO metadata
```tsx
import { auth } from "@/lib/auth"
import { LandingPage } from "@/components/landing-page"

export default async function Home() {
  const session = await auth()
  return <LandingPage session={session} />
}
```

### Pricing Page (`web/src/app/(public)/pricing/page.tsx`, 140 lines) — title-only metadata
```tsx
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "요금제" }
// ... (rest is pricing UI — plans array, comparison table, FAQ section)
```

### About Page (`web/src/app/(public)/about/page.tsx`, 59 lines) — title-only metadata
```tsx
import type { Metadata } from "next"

export const metadata: Metadata = { title: "소개" }
// ... (rest is about page UI — brand story, features grid, vision)
```

### FAQ Page (`web/src/app/(public)/faq/page.tsx`, 69 lines) — "use client", NO metadata possible
```tsx
"use client"

import { useState } from "react"

const categories = ["전체", "일반", "요금제", "로고 생성", "계정"] as const

const faqs: { category: string; q: string; a: string }[] = [
  { category: "일반", q: "Splash는 무엇인가요?", a: "Splash는 AI와의 대화를 통해 로고를 생성하고 수정할 수 있는 디자인 플랫폼입니다..." },
  // ... 11 FAQ items total
]

export default function FaqPage() {
  const [active, setActive] = useState<string>("전체")
  const filtered = active === "전체" ? faqs : faqs.filter((f) => f.category === active)
  return (
    <div className="bg-[var(--bg-primary)]">
      <section className="mx-auto max-w-6xl px-6 py-24">
        <h1 className="text-center text-4xl font-bold md:text-5xl">자주 묻는 질문</h1>
        {/* category nav + Q&A details */}
      </section>
    </div>
  )
}
```

### Terms Page (`web/src/app/(public)/terms/page.tsx`, 111 lines) — "use client", NO metadata possible
```tsx
"use client"

import { useState } from "react"

const tabs = ["이용약관", "개인정보처리방침"] as const

export default function TermsPage() {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("이용약관")
  return (
    <div className="bg-[var(--bg-primary)]">
      <section className="mx-auto max-w-[65ch] px-6 py-24">
        <h1 className="text-4xl font-bold">법적 고지</h1>
        {/* tab UI + TermsContent / PrivacyContent components */}
      </section>
    </div>
  )
}
// TermsContent() — 이용약관 content (제1조~제5조)
// PrivacyContent() — 개인정보처리방침 content (1~5)
```

### Login Page (`web/src/app/login/page.tsx`, 55 lines) — "use client", NO metadata
```tsx
"use client"

import Link from "next/link"
import { signIn } from "next-auth/react"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      {/* Google OAuth login button + branding */}
    </div>
  )
}
```

### Public Layout (`web/src/app/(public)/layout.tsx`, 16 lines) — Server component, no metadata
```tsx
import { auth } from "@/lib/auth"
import { SharedHeader } from "@/components/shared-header"
import { SharedFooter } from "@/components/shared-footer"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const headerSession = session?.user ? { user: { id: (session.user as { id: string }).id, email: session.user.email, name: session.user.name, image: session.user.image } } : null
  return (
    <>
      <SharedHeader session={headerSession} />
      <main className="pt-16">{children}</main>
      <SharedFooter />
    </>
  )
}
```

### Key Findings
- **favicon.ico** exists at `web/src/app/favicon.ico` (Next.js auto-detects this)
- **public/** only contains SVGs: file.svg, globe.svg, next.svg, vercel.svg, window.svg
- No sitemap.ts, robots.ts, or manifest.ts exist
- No OG images exist
- FAQ, Terms, Login are all "use client" — metadata must be added via wrapper layouts
- Domain: `https://usesplash.vercel.app`

### Strategy for "use client" Pages
Client components cannot export `metadata` or `generateMetadata`. The solution is to create a `layout.tsx` wrapper in each route folder that exports metadata. This is the standard Next.js pattern — the layout is a server component that provides metadata while the page remains a client component.

---

## Testing Plan (TDD — tests first)

> **Note:** This change is purely declarative metadata configuration (static exports, new route files). There is no business logic to unit-test. Verification is done via build success + manual checks described in Done Criteria.

- [x] T1: Run `pnpm build` in `web/` to confirm current build passes before any changes (baseline)
- [x] T2: After ALL implementation tasks complete, run `pnpm build` in `web/` — must succeed with zero errors
- [x] T3: After build, verify sitemap output: `curl https://usesplash.vercel.app/sitemap.xml` (or check build output for sitemap route)
- [x] T4: After build, verify robots output: `curl https://usesplash.vercel.app/robots.txt` (or check build output for robots route)
- [x] T5: After build, verify manifest output: check `/manifest.webmanifest` route exists in build

---

## Implementation Plan

### Phase 1: Root Layout + Core SEO Files (no dependencies)

- [x] I1: **Edit `web/src/app/layout.tsx`** — Replace the metadata export with comprehensive SEO metadata:
  - Add `import type { Viewport } from "next"` to imports
  - Set `metadataBase: new URL("https://usesplash.vercel.app")`
  - Keep existing `title` template
  - Enhance `description` (keep Korean, expand slightly)
  - Add `applicationName: "Splash"`
  - Add `creator: "Splash"`, `publisher: "Splash"`
  - Add `keywords: ["AI 로고", "로고 디자인", "AI logo design", "logo maker", "Splash", "AI 디자인"]`
  - Add `robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large" as const, "max-snippet": -1 } }`
  - Add `openGraph: { type: "website", locale: "ko_KR", url: "https://usesplash.vercel.app", siteName: "Splash", title: "Splash — AI 로고 디자인", description: "AI 채팅으로 프로페셔널한 로고를 디자인하세요", images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Splash — AI 로고 디자인" }] }`
  - Add `twitter: { card: "summary_large_image", title: "Splash — AI 로고 디자인", description: "AI 채팅으로 프로페셔널한 로고를 디자인하세요", images: ["/og-image.png"] }`
  - Add `alternates: { canonical: "https://usesplash.vercel.app" }`
  - Add `formatDetection: { telephone: false }`
  - Add separate `export const viewport: Viewport = { width: "device-width", themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0e0e0e" }, { media: "(prefers-color-scheme: light)", color: "#ffffff" }] }`
  - Add JSON-LD `<script>` tag inside `<head>` in the html element (add `<head>` tag between `<html>` and `<body>`):
    ```tsx
    <head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Splash",
            url: "https://usesplash.vercel.app",
            description: "AI 채팅 기반 로고 디자인 SaaS",
            publisher: {
              "@type": "Organization",
              name: "Splash",
              url: "https://usesplash.vercel.app",
            },
          }),
        }}
      />
    </head>
    ```

- [x] I2: **Create `web/src/app/sitemap.ts`** — New file with static sitemap:
  ```ts
  import type { MetadataRoute } from "next"

  export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = "https://usesplash.vercel.app"
    return [
      { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
      { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
      { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
      { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
      { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
      { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    ]
  }
  ```

- [x] I3: **Create `web/src/app/robots.ts`** — New file with crawler rules:
  ```ts
  import type { MetadataRoute } from "next"

  export default function robots(): MetadataRoute.Robots {
    return {
      rules: [
        {
          userAgent: "*",
          allow: "/",
          disallow: ["/api/", "/projects/", "/admin/"],
        },
      ],
      sitemap: "https://usesplash.vercel.app/sitemap.xml",
      host: "https://usesplash.vercel.app",
    }
  }
  ```

- [x] I4: **Create `web/src/app/manifest.ts`** — New file with PWA manifest:
  ```ts
  import type { MetadataRoute } from "next"

  export default function manifest(): MetadataRoute.Manifest {
    return {
      name: "Splash — AI 로고 디자인",
      short_name: "Splash",
      description: "AI 채팅으로 프로페셔널한 로고를 디자인하세요",
      start_url: "/",
      display: "standalone",
      background_color: "#0e0e0e",
      theme_color: "#0e0e0e",
      icons: [
        { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      ],
    }
  }
  ```

- [x] I5: **Create `web/src/app/opengraph-image.tsx`** — Dynamic OG image generator:
  ```tsx
  import { ImageResponse } from "next/og"

  export const alt = "Splash — AI 로고 디자인"
  export const size = { width: 1200, height: 630 }
  export const contentType = "image/png"

  export default function Image() {
    return new ImageResponse(
      (
        <div
          style={{
            background: "linear-gradient(135deg, #0e0e0e 0%, #1a1a1a 100%)",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 700, color: "#ffffff", display: "flex" }}>
            Sp<span style={{ color: "#4CAF50" }}>lash</span>
          </div>
          <div style={{ fontSize: 28, color: "#888888", marginTop: 16 }}>
            AI 채팅으로 로고를 디자인하세요
          </div>
        </div>
      ),
      { ...size }
    )
  }
  ```

### Phase 2: Page-Level Metadata

- [x] I6: **Edit `web/src/app/(public)/page.tsx`** — Add metadata export for landing page:
  ```tsx
  import type { Metadata } from "next"
  // ... existing imports

  export const metadata: Metadata = {
    title: "AI 채팅으로 로고 디자인 | Splash",
    description: "AI와 대화하며 프로페셔널한 로고를 만드세요. 복잡한 디자인 도구 없이, 자연어로 브랜드 아이덴티티를 완성합니다.",
    alternates: { canonical: "https://usesplash.vercel.app" },
  }
  ```
  Note: Landing page uses `title` as full string (not template) since this is the homepage.

- [x] I7: **Edit `web/src/app/(public)/pricing/page.tsx`** — Enhance metadata:
  Replace `export const metadata: Metadata = { title: "요금제" }` with:
  ```tsx
  export const metadata: Metadata = {
    title: "요금제",
    description: "Splash 무료 플랜부터 Pro, Enterprise까지. AI 로고 디자인 서비스 요금을 확인하세요.",
    alternates: { canonical: "https://usesplash.vercel.app/pricing" },
    openGraph: {
      title: "요금제 | Splash",
      description: "Splash 무료 플랜부터 Pro, Enterprise까지. AI 로고 디자인 서비스 요금을 확인하세요.",
      url: "https://usesplash.vercel.app/pricing",
    },
  }
  ```

- [x] I8: **Edit `web/src/app/(public)/about/page.tsx`** — Enhance metadata:
  Replace `export const metadata: Metadata = { title: "소개" }` with:
  ```tsx
  export const metadata: Metadata = {
    title: "소개",
    description: "Splash는 AI와의 자연어 대화를 통해 누구나 전문가 수준의 로고를 만들 수 있는 디자인 플랫폼입니다.",
    alternates: { canonical: "https://usesplash.vercel.app/about" },
    openGraph: {
      title: "소개 | Splash",
      description: "Splash는 AI와의 자연어 대화를 통해 누구나 전문가 수준의 로고를 만들 수 있는 디자인 플랫폼입니다.",
      url: "https://usesplash.vercel.app/about",
    },
  }
  ```

- [x] I9: **Create `web/src/app/(public)/faq/layout.tsx`** — Metadata wrapper for client-component FAQ page:
  ```tsx
  import type { Metadata } from "next"

  export const metadata: Metadata = {
    title: "자주 묻는 질문",
    description: "Splash 이용에 대한 자주 묻는 질문과 답변. 요금제, 로고 생성, 계정 관련 궁금증을 해결하세요.",
    alternates: { canonical: "https://usesplash.vercel.app/faq" },
    openGraph: {
      title: "자주 묻는 질문 | Splash",
      description: "Splash 이용에 대한 자주 묻는 질문과 답변.",
      url: "https://usesplash.vercel.app/faq",
    },
  }

  export default function FaqLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }
  ```
  Additionally, add FAQPage JSON-LD structured data. Since the FAQ data is hardcoded in the client component, duplicate the Q&A data in the layout as a JSON-LD script:
  ```tsx
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: "Splash는 무엇인가요?", acceptedAnswer: { "@type": "Answer", text: "Splash는 AI와의 대화를 통해 로고를 생성하고 수정할 수 있는 디자인 플랫폼입니다." } },
      { "@type": "Question", name: "어떤 AI 기술을 사용하나요?", acceptedAnswer: { "@type": "Answer", text: "Google Gemini 기반의 이미지 생성 AI와 대화형 AI를 결합하여 사용합니다." } },
      { "@type": "Question", name: "무료 플랜으로 무엇을 할 수 있나요?", acceptedAnswer: { "@type": "Answer", text: "무료 플랜에서는 3개의 프로젝트를 만들고, 하루 10회의 로고 생성이 가능합니다." } },
      { "@type": "Question", name: "Pro 플랜으로 업그레이드하면 무엇이 달라지나요?", acceptedAnswer: { "@type": "Answer", text: "무제한 프로젝트, 하루 100회 생성, SVG 변환, 배경 제거, 고해상도 출력 등 프리미엄 기능을 이용할 수 있습니다." } },
      { "@type": "Question", name: "한 번에 몇 개의 시안을 받을 수 있나요?", acceptedAnswer: { "@type": "Answer", text: "한 번의 요청으로 최대 5개의 시안을 동시에 생성할 수 있습니다." } },
      { "@type": "Question", name: "생성된 로고를 수정할 수 있나요?", acceptedAnswer: { "@type": "Answer", text: "네, 자연어로 수정 요청을 할 수 있습니다. 수정본은 버전으로 관리됩니다." } },
    ],
  }
  ```
  Render as `<script type="application/ld+json">` inside the layout return.

- [x] I10: **Create `web/src/app/(public)/terms/layout.tsx`** — Metadata wrapper for client-component Terms page:
  ```tsx
  import type { Metadata } from "next"

  export const metadata: Metadata = {
    title: "이용약관 및 개인정보처리방침",
    description: "Splash 서비스 이용약관과 개인정보처리방침을 확인하세요.",
    alternates: { canonical: "https://usesplash.vercel.app/terms" },
    openGraph: {
      title: "이용약관 | Splash",
      description: "Splash 서비스 이용약관과 개인정보처리방침.",
      url: "https://usesplash.vercel.app/terms",
    },
  }

  export default function TermsLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }
  ```

- [x] I11: **Create `web/src/app/login/layout.tsx`** — Metadata wrapper with noindex for login page:
  ```tsx
  import type { Metadata } from "next"

  export const metadata: Metadata = {
    title: "로그인",
    description: "Google 계정으로 Splash에 로그인하세요.",
    robots: { index: false, follow: false },
  }

  export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }
  ```

### Phase 3: Next.js Config + Security Headers

- [x] I12: **Edit `web/next.config.ts`** — Add security headers:
  ```ts
  import type { NextConfig } from "next";

  const securityHeaders = [
    { key: "X-DNS-Prefetch-Control", value: "on" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];

  const nextConfig: NextConfig = {
    async headers() {
      return [
        {
          source: "/(.*)",
          headers: securityHeaders,
        },
      ];
    },
  };

  export default nextConfig;
  ```

---

## Parallelization Plan

### Batch 1 (parallel — 3 coders, no file overlap)

- [x] **Coder A**: Tasks I1, I5 → files: `web/src/app/layout.tsx`, `web/src/app/opengraph-image.tsx`
  - Edit root layout with full metadata + viewport + JSON-LD
  - Create OG image generator

- [x] **Coder B**: Tasks I2, I3, I4 → files: `web/src/app/sitemap.ts`, `web/src/app/robots.ts`, `web/src/app/manifest.ts`
  - Create all three new SEO route files

- [x] **Coder C**: Tasks I6, I7, I8 → files: `web/src/app/(public)/page.tsx`, `web/src/app/(public)/pricing/page.tsx`, `web/src/app/(public)/about/page.tsx`
  - Add/enhance metadata on server-component public pages

### Batch 2 (parallel — 2 coders, after Batch 1)

- [x] **Coder D**: Tasks I9, I10, I11 → files: `web/src/app/(public)/faq/layout.tsx`, `web/src/app/(public)/terms/layout.tsx`, `web/src/app/login/layout.tsx`
  - Create metadata wrapper layouts for all client-component pages
  - Include FAQ JSON-LD structured data

- [x] **Coder E**: Task I12 → files: `web/next.config.ts`
  - Add security headers configuration

### Batch 3 (sequential — verification)

- [x] **Any Coder**: Tasks T2, T3, T4, T5 → Run build and verify all SEO outputs

### Dependencies

- Batch 2 can technically run in parallel with Batch 1 since no files overlap, but logically it's cleaner to do wrapper layouts after core metadata is established.
- Batch 3 (verification) must run after all implementation batches complete.
- T1 (baseline build check) should run before any changes.

### Risk Areas

- **FAQ JSON-LD duplication**: The FAQ Q&A data is hardcoded in the client page component. The layout duplicates a subset for JSON-LD. If FAQ content changes, both files need updating. Consider extracting to a shared data file in the future.
- **OG Image generation**: `next/og` ImageResponse may have font limitations. The generated image uses system fonts. If custom branding fonts are needed later, font files must be loaded.
- **Metadata merging**: Child page metadata overrides parent (root layout) for primitive fields. Object fields (openGraph) in child pages will completely replace parent openGraph, not merge. Each page that specifies `openGraph` must include all needed OG fields.
- **Login page layout nesting**: `web/src/app/login/layout.tsx` will nest inside root layout. This is fine — it only adds metadata, no extra DOM.

---

## Done Criteria

- [ ] `pnpm build` succeeds with zero TypeScript/build errors
- [ ] All public pages have `<title>`, `<meta name="description">`, OG tags, and canonical URLs in rendered HTML
- [ ] `/sitemap.xml` returns valid XML with all 6 public URLs
- [ ] `/robots.txt` returns valid robots with allow `/`, disallow `/api/`, `/projects/`, `/admin/`, and sitemap reference
- [ ] `/manifest.webmanifest` returns valid JSON with app name, colors, icons
- [ ] Root layout includes JSON-LD WebSite + Organization schema
- [ ] FAQ page includes JSON-LD FAQPage schema
- [ ] Login page has `noindex, nofollow` robot directive
- [ ] Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.) are present on responses
- [ ] OG image route (`/opengraph-image`) generates a valid PNG
- [ ] Viewport meta tag includes `width=device-width` and `theme-color`
