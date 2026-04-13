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
