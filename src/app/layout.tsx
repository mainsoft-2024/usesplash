import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL("https://usesplash.vercel.app"),
  title: { default: "Splash", template: "%s | Splash" },
  description: "AI 채팅으로 프로페셔널한 로고를 디자인하세요. 브랜드에 맞는 결과물을 빠르게 완성할 수 있습니다.",
  applicationName: "Splash",
  creator: "Splash",
  publisher: "Splash",
  keywords: ["AI 로고", "로고 디자인", "AI logo design", "logo maker", "Splash", "AI 디자인"],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://usesplash.vercel.app",
    siteName: "Splash",
    title: "Splash — AI 로고 디자인",
    description: "AI 채팅으로 프로페셔널한 로고를 디자인하세요",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Splash — AI 로고 디자인" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Splash — AI 로고 디자인",
    description: "AI 채팅으로 프로페셔널한 로고를 디자인하세요",
    images: ["/og-image.png"],
  },
  alternates: { canonical: "https://usesplash.vercel.app" },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: "device-width",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0e" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  name: "Splash",
                  url: "https://usesplash.vercel.app",
                  description: "AI 채팅 기반 로고 디자인 SaaS",
                  publisher: { "@id": "https://usesplash.vercel.app/#organization" },
                },
                {
                  "@type": "Organization",
                  "@id": "https://usesplash.vercel.app/#organization",
                  name: "Splash",
                  url: "https://usesplash.vercel.app",
                },
              ],
            }),
          }}
        />
      </head>
      <body className={`${inter.className} bg-[#0e0e0e] text-white antialiased min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
