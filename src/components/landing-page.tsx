"use client"

import Link from "next/link"

const steps = [
  {
    icon: "💬",
    title: "AI와 대화",
    description: "브랜드명, 스타일, 색상을 자연어로 알려주세요",
  },
  {
    icon: "🎨",
    title: "시안 생성",
    description: "AI가 다양한 로고 시안을 즉시 만들어 드립니다",
  },
  {
    icon: "✏️",
    title: "수정 & 완성",
    description: "원하는 시안을 선택하고 자연어로 수정 요청하세요",
  },
]

const features = [
  ["🤖", "AI 인터뷰", "대화로 디자인 요구사항을 정확히 파악"],
  ["🖼️", "배치 생성", "한 번에 여러 시안을 만들고 갤러리에서 비교"],
  ["✨", "이미지 편집", "재생성이 아닌 원본 기반 수정 (색상, 텍스트, 배경 등)"],
  ["🌿", "버전 관리", "수정본이 버전으로 쌓이고, 특정 버전에서 분기 가능"],
  ["⌨️", "키보드 내비게이션", "↑↓로 버전 전환, ←→로 로고 이동"],
  ["📦", "내보내기", "크롭, 배경제거, SVG 벡터 변환 원클릭"],
] as const

const pricing = [
  {
    name: "Free",
    detail: "3 프로젝트 · 10회/일 생성 · 기본 내보내기",
    cta: "무료로 시작",
    href: "/login",
    featured: false,
  },
  {
    name: "Pro",
    detail: "무제한 프로젝트 · 100회/일 생성 · 프리미엄 내보내기",
    cta: "문의하기",
    href: "mailto:hello@usesplash.vercel.app",
    featured: true,
  },
  {
    name: "Enterprise",
    detail: "무제한 · 우선 생성 · 전용 지원",
    cta: "문의하기",
    href: "mailto:hello@usesplash.vercel.app",
    featured: false,
  },
] as const

export function LandingPage() {
  return (
    <main className="scroll-smooth bg-[#0e0e0e] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-8 md:px-8">
        <header className="mb-16 flex items-center justify-between">
          <div className="text-xl font-semibold tracking-tight">Splash</div>
          <nav className="hidden gap-6 text-sm text-zinc-400 md:flex">
            <a href="#how" className="hover:text-zinc-100">작동 방식</a>
            <a href="#features" className="hover:text-zinc-100">기능</a>
            <a href="#pricing" className="hover:text-zinc-100">요금제</a>
          </nav>
          <Link href="/login" className="rounded-lg border border-[#2a2a2a] px-4 py-2 text-sm hover:border-[#4CAF50] hover:text-[#4CAF50]">
            무료로 시작하기
          </Link>
        </header>

        <section className="fade-in-up grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-4 inline-block rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1 text-xs text-zinc-300">
              usesplash.vercel.app
            </p>
            <h1 className="whitespace-pre-line text-4xl font-bold leading-tight md:text-6xl">
              {"AI와 대화하며\n로고를 디자인하세요"}
            </h1>
            <p className="mt-5 max-w-xl text-zinc-400">
              Splash는 AI 채팅으로 브랜드 로고를 만들고, 수정하고, 완성하는 올인원 디자인 플랫폼입니다
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login" className="rounded-xl bg-[#4CAF50] px-6 py-3 font-medium text-black transition hover:brightness-110">
                무료로 시작하기
              </Link>
              <span className="text-sm text-zinc-400">3개 프로젝트 무료 · 신용카드 불필요</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-[#4CAF50]/30 to-teal-400/20 blur-2xl" />
            <div className="relative rounded-3xl border border-[#2a2a2a] bg-[#141414] p-4 shadow-2xl">
              <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
                <span className="h-2 w-2 rounded-full bg-zinc-700" />
                <span className="h-2 w-2 rounded-full bg-zinc-700" />
                <span className="h-2 w-2 rounded-full bg-zinc-700" />
                2패널 워크스페이스
              </div>
              <div className="grid h-[340px] grid-cols-[1fr_1.2fr] gap-3">
                <div className="rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] p-3">
                  <div className="mb-2 h-8 rounded-lg bg-[#1c1c1c]" />
                  <div className="space-y-2">
                    <div className="h-10 rounded-lg bg-[#1a1a1a]" />
                    <div className="ml-6 h-10 rounded-lg bg-[#17311d]" />
                    <div className="h-10 rounded-lg bg-[#1a1a1a]" />
                    <div className="ml-8 h-10 rounded-lg bg-[#17311d]" />
                  </div>
                </div>
                <div className="rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f] p-3">
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-[#2b2b2b] to-[#1b1b1b]" />
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-[#21462a] to-[#142b1a]" />
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-[#2b2b2b] to-[#1b1b1b]" />
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-[#2b2b2b] to-[#1b1b1b]" />
                  </div>
                  <div className="h-7 w-28 rounded-full bg-[#17311d]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="fade-in-up mt-24">
          <h2 className="text-3xl font-semibold">작동 방식</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
                <div className="mb-3 text-2xl">{step.icon}</div>
                <p className="mb-1 text-xs text-[#4CAF50]">0{index + 1}</p>
                <h3 className="text-lg font-medium">{step.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="fade-in-up mt-24">
          <h2 className="text-3xl font-semibold">핵심 기능</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([icon, title, desc]) => (
              <article key={title} className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
                <div className="mb-2 text-2xl">{icon}</div>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="fade-in-up mt-24">
          <h2 className="text-3xl font-semibold">요금제</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {pricing.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-2xl border p-6 ${
                  plan.featured
                    ? "border-[#4CAF50] bg-gradient-to-b from-[#15341d] to-[#1a1a1a]"
                    : "border-[#2a2a2a] bg-[#1a1a1a]"
                }`}
              >
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <ul className="mt-5 space-y-2 text-sm text-zinc-300">
                  {plan.detail.split(" · ").map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`mt-6 inline-block rounded-xl px-4 py-2 text-sm font-medium ${
                    plan.featured
                      ? "bg-[#4CAF50] text-black"
                      : "border border-[#2a2a2a] text-zinc-200 hover:border-[#4CAF50] hover:text-[#4CAF50]"
                  }`}
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-24 border-t border-[#2a2a2a] pt-8 text-sm text-zinc-500">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p>© 2026 Splash. AI-powered logo design.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-zinc-300">이용약관</a>
              <a href="#" className="hover:text-zinc-300">개인정보처리방침</a>
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        .fade-in-up {
          animation: fade-in-up 0.9s ease-out both;
        }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  )
}
