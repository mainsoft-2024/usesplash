import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { LandingPage } from "@/components/landing-page"

export const metadata: Metadata = {
  title: "AI 채팅으로 로고 디자인 | Splash",
  description: "AI와 대화하며 프로페셔널한 로고를 만드세요. 복잡한 디자인 도구 없이, 자연어로 브랜드 아이덴티티를 완성합니다.",
  alternates: { canonical: "https://usesplash.vercel.app" },
}

export default async function Home() {
  const session = await auth()
  return <LandingPage session={session} />
}
