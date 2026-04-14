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