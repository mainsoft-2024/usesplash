import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "로그인",
  description: "Google 계정으로 Splash에 로그인하세요.",
  robots: { index: false, follow: false },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}