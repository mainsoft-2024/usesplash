# Research: Next.js 15 App Router SEO Best Practices
Date: 2026-04-14

## Summary

Next.js 15 provides a comprehensive, built-in Metadata API that replaces third-party SEO packages like `next-seo`. The App Router uses a declarative approach with file-based conventions for metadata, sitemaps, robots.txt, OG images, and PWA manifests. All SEO features are implemented through exports in `layout.tsx`/`page.tsx` files or special route handler files, with automatic merging across nested layouts.

---

## 1. Metadata API (generateMetadata, metadata export)

### Static Metadata Export

Export a `metadata` object from any route segment (`layout.tsx` or `page.tsx`):

```typescript
// app/layout.tsx or app/blog/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Splash - AI Logo Design",
    template: "%s | Splash",
  },
  description: "AI-powered logo design SaaS. Create stunning logos with AI.",
  metadataBase: new URL("https://usesplash.vercel.app"),
  authors: [{ name: "Splash Team" }],
  creator: "mainsoft-2024",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://usesplash.vercel.app",
    siteName: "Splash",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@splash",
  },
};
```

### Dynamic Metadata with generateMetadata

For dynamic pages (blog posts, products), export an async `generateMetadata` function:

```typescript
// app/blog/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  
  if (!post) {
    return { title: "Post Not Found" };
  }
  
  const url = `https://usesplash.vercel.app/blog/${slug}`;
  
  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.excerpt,
      authors: [post.author],
      publishedTime: post.publishedAt,
      images: [
        {
          url: post.ogImage,
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  // ... render
}
```

### Full Metadata Options

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` or `Title` object | Page title with template support |
| `description` | `string` | Meta description (50-160 chars) |
| `metadataBase` | `URL` | Base URL for relative URLs |
| `applicationName` | `string` | PWA app name |
| `authors` | `Author[]` | Author information |
| `creator` | `string` | Content creator |
| `generator` | `string` | Generator name |
| `keywords` | `string[]` | SEO keywords |
| `metadataViewers` | `MetadataViewer[]` | For indexing |
| `publisher` | `string` | Publisher name |
| `robots` | `Robots` object | Crawler directives |
| `alternates` | `Alternates` object | Canonical/language variants |
| `appleWebApp` | `AppleWebApp` object | iOS web app config |
| `formatDetection` | `FormatDetection` object | Phone/email detection |
| `openGraph` | `OpenGraph` object | Social sharing |
| `twitter` | `Twitter` object | Twitter cards |
| `archive` | `MetadataArchive[]` | Archive links |
| `robots` | `Robots` object | Indexing rules |
| `verification` | `Verification` object | Site verification |

---

## 2. sitemap.ts / robots.ts File Conventions

### Dynamic Sitemap

Create `app/sitemap.ts` (or `.js`):

```typescript
// app/sitemap.ts
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://usesplash.vercel.app";
  
  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
  
  // Dynamic pages from database
  const posts = await getAllPosts();
  const postPages = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  
  return [...staticPages, ...postPages];
}
```

### Dynamic Robots.txt

Create `app/robots.ts`:

```typescript
// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/private/", "/api/", "/admin/"],
      },
    ],
    sitemap: "https://usesplash.vercel.app/sitemap.xml",
    host: "https://usesplash.vercel.app",
  };
}
```

---

## 3. OpenGraph Images (opengraph-image.tsx)

### Static Image File

Place `opengraph-image.(jpg|jpeg|png|gif)` in any route segment:

```
app/
├── blog/
│   ├── page.tsx
│   └── opengraph-image.png    # 1200x630 recommended
```

### Code-Generated Image

Create `opengraph-image.tsx` using `ImageResponse` from `next/og`:

```tsx
// app/blog/opengraph-image.tsx
import { ImageResponse } from "next/og";
import { getBlogTitle } from "@/lib/data";

export const alt = "Splash Blog";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  const title = await getBlogTitle();
  
  return new ImageResponse(
    <div
      style={{
        background: "linear-gradient(to right, #000, #1a1a1a)",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: 80,
          fontWeight: "bold",
          textAlign: "center",
          padding: "0 40px",
        }}
      >
        {title}
      </div>
    </div>,
    { ...size }
  );
}
```

### Dynamic Routes

For dynamic routes, use `params`:

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const alt = "Blog Post";
export const size = { width: 1200, height: 630 };

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  
  return new ImageResponse(
    <div style={{ display: "flex", background: "#fff", width: "100%", height: "100%" }}>
      <img src={post.coverImage} alt={post.title} />
      <h1>{post.title}</h1>
    </div>,
    { ...size, fonts: [{ name: "Inter", data: fontData, style: "normal" }] }
  );
}
```

For multiple images per route, export `generateImageMetadata`:

```tsx
export function generateImageMetadata() {
  return [
    { id: "1", text: "Blog Post 1" },
    { id: "2", text: "Blog Post 2" },
  ];
}

export default async function Image({ params, id }: { params: { slug: string }; id: string }) {
  const post = await getPostBySlug(params.slug);
  return new ImageResponse(<div>{post.title}</div>, { width: 1200, height: 630 });
}
```

---

## 4. Structured Data (JSON-LD) for SaaS Products

### Using Script Tag in Page

```tsx
// app/products/[slug]/page.tsx
import type { Metadata } from "next";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.slug);
  return { title: product.name, description: product.description };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.slug);
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    sku: product.sku,
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "USD",
      availability: product.inStock 
        ? "https://schema.org/InStock" 
        : "https://schema.org/OutOfStock",
      url: `https://usesplash.vercel.app/products/${product.slug}`,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    },
  };
  
  return (
    <section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Product content */}
    </section>
  );
}
```

### SaaS/Organization Schema

```tsx
// app/layout.tsx - site-wide schema
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Splash",
  url: "https://usesplash.vercel.app",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://usesplash.vercel.app/search?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

return (
  <html>
    <head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </head>
    <body>{children}</body>
  </html>
);
```

### Type-Safe Schema with schema-dts

```bash
pnpm add schema-dts
```

```tsx
import { Product, WithContext } from "schema-dts";

const productSchema: WithContext<Product> = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: product.name,
  image: product.images,
  offers: {
    "@type": "Offer",
    price: product.price,
    priceCurrency: "USD",
  },
};
```

---

## 5. Web Manifest for PWA

### Static Manifest

Create `app/manifest.json`:

```json
{
  "name": "Splash - AI Logo Design",
  "short_name": "Splash",
  "description": "AI-powered logo design SaaS",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Dynamic Manifest

Create `app/manifest.ts`:

```typescript
// app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Splash - AI Logo Design",
    short_name: "Splash",
    description: "AI-powered logo design SaaS",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
```

Link in metadata:

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  manifest: "/manifest.json",
};
```

---

## 6. Canonical URLs

### Using alternates.canonical

```typescript
export const metadata = {
  alternates: {
    canonical: "https://usesplash.vercel.app/blog/my-post",
  },
};
```

### Dynamic Canonical

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  
  return {
    alternates: {
      canonical: `https://usesplash.vercel.app/blog/${post.slug}`,
      languages: {
        "en-US": `https://usesplash.vercel.app/blog/${post.slug}`,
        "ko-KR": `https://usesplash.vercel.app/ko/blog/${post.slug}`,
      },
    },
  };
}
```

### Full alternates Options

```typescript
export const metadata = {
  alternates: {
    canonical: "https://usesplash.vercel.app",
    languages: {
      "en-US": "https://usesplash.vercel.app/en-US",
      "ko-KR": "https://usesplash.vercel.app/ko-KR",
    },
    media: {
      "only screen and (max-width: 600px)": "https://mobile.usesplash.vercel.app",
    },
    types: {
      "application/rss+xml": "https://usesplash.vercel.app/rss",
    },
  },
};
```

---

## 7. Viewport and theme-color Meta

### Separate Viewport Export (Next.js 15+)

For Next.js 15+, viewport config is a separate export:

```typescript
// app/layout.tsx
import type { Viewport } from "next";

export const metadata: Metadata = {
  title: "Splash",
  description: "AI Logo Design SaaS",
};

export const viewport: Viewport = {
  width: "device-width",
  height: "device-height",
  themeColor: "#000000",
};

// Or with media queries for light/dark mode
export const viewport: Viewport = {
  width: "device-width",
  height: "device-height",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};
```

### Legacy Combined Metadata (deprecated in Next.js 15)

```typescript
// OLD WAY - still works but not recommended
export const metadata = {
  title: "Splash",
  viewport: {
    width: "device-width",
    themeColor: "#000000",
  },
};
```

Use codemod to migrate:

```bash
npx @next/codemod@latest metadata-to-viewport-export .
```

---

## 8. Twitter Card Setup

### Basic Twitter Card

```typescript
export const metadata: Metadata = {
  twitter: {
    card: "summary_large_image",
    title: "Splash - AI Logo Design",
    description: "Create stunning logos with AI",
    creator: "@splash",
    images: ["https://usesplash.vercel.app/og.png"],
  },
};
```

### Twitter App Card

```typescript
export const metadata: Twitter = {
  card: "app",
  title: "Splash",
  description: "AI Logo Design",
  app: {
    name: "Splash",
    id: {
      iphone: "id123456789",
      ipad: "id123456789",
      googleplay: "com.splash.app",
    },
    url: {
      iphone: "https://apps.apple.com/app/splash",
      ipad: "https://apps.apple.com/app/splash",
    },
  },
};
```

### Twitter Player Card

```typescript
export const metadata: Twitter = {
  card: "player",
  title: "Splash Demo",
  description: "Watch how Splash works",
  player: {
    url: "https://usesplash.vercel.app/demo",
    width: 1280,
    height: 720,
  },
  images: ["https://usesplash.vercel.app/og.png"],
};
```

---

## 9. Next.js 15 Specific SEO Features

### Async Params (Next.js 15+)

```typescript
// Next.js 15: params is a Promise
type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; // Must await
  const post = await getPostBySlug(slug);
  // ...
}
```

### Metadata Merging Behavior

- **Primitive fields** (title, description): Child overrides parent
- **Object fields** (openGraph, twitter): Child overrides parent completely
- **Array fields** (openGraph.images): Replaced by child

```typescript
// Parent layout
export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/default-og.png" }],
  },
};

// Child page - this REPLACES, not merges
export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/custom-og.png" }], // Replaces parent
  },
};
```

### Request Memoization

`generateMetadata` and the page component share cached data:

```typescript
// Same fetch is memoized automatically
export async function generateMetadata({ params }: Props) {
  const post = await getPost(params.slug); // Cached
  return { title: post.title };
}

export default async function Page({ params }: Props) {
  const post = await getPost(params.slug); // Uses cached result
  return <article>{post.content}</article>;
}
```

### Streaming Metadata

For dynamically rendered pages, metadata streams separately for faster Time to First Byte (TTFB).

### robots Directive

```typescript
export const metadata: Metadata = {
  robots: {
    index: true,      // Allow indexing
    follow: true,    // Follow links
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};
```

For noindex pages:

```typescript
export async function generateMetadata({ params }: Props) {
  const post = await getPost(params.slug);
  if (!post.published) {
    return {
      robots: "noindex, nofollow",
    };
  }
  return {};
}
```

---

## Quick Reference

### File Structure

```
app/
├── layout.tsx              # Root metadata
├── page.tsx                # Home page
├── sitemap.ts              # Dynamic sitemap
├── robots.ts               # Crawler rules
├── manifest.json           # PWA manifest
├── favicon.ico             # Auto-detected
├── opengraph-image.tsx      # OG image generator
├── twitter-image.tsx       # Twitter image
├── blog/
│   ├── page.tsx            # Blog listing
│   ├── opengraph-image.tsx # Blog OG image
│   └── [slug]/
│       ├── page.tsx         # Individual post
│       └── opengraph-image.tsx # Dynamic OG image
├── products/
│   └── [slug]/
│       └── page.tsx        # Product page with JSON-LD
└── error.tsx              # Error page should have metadata
```

### Validation Tools

- Google Rich Results Test: https://search.google.com/test/rich-results
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug
- Schema Markup Validator: https://validator.schema.org

---

## Resources

- [Next.js Metadata API Docs](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Next.js Sitemap Docs](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [Next.js Robots Docs](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots)
- [Next.js OG Image Docs](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
- [Next.js Manifest Docs](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest)
- [JSON-LD Guides](https://nextjs.org/docs/app/guides/json-ld)
- [PWA Guides](https://nextjs.org/docs/app/guides/progressive-web-apps)