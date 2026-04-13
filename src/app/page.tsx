"use client"

import Link from "next/link"

const steps = [
  { emoji: "💬", title: "AI에게 말하세요", desc: "브랜드명, 스타일, 색상을 알려주면 AI가 인터뷰합니다" },
  { emoji: "🎨", title: "시안을 받으세요", desc: "AI가 8개 이상의 로고 시안을 한번에 생성합니다" },
  { emoji: "✏️", title: "대화로 수정하세요", desc: '"3번 로고에서 색상 바꿔줘" 한마디면 끝' },
]

const features = [
  "🤖 AI 인터뷰 — 브랜드/스타일/색상을 대화로 수집",
  "🖼️ 배치 생성 — 한번에 여러 시안 생성",
  "✏️ 이미지 편집 — 재생성이 아닌 실제 편집",
  "🔀 버전 관리 — 수정본 스택, 분기(fork) 지원",
  "📤 내보내기 — 크롭, 배경제거, SVG 변환",
  "📁 프로젝트 관리 — 프로젝트별 분리, 히스토리",
]

const pricing = [
  {
    name: "Free",
    detail: "3 프로젝트 · 10회/일 생성 · 기본 내보내기",
    price: "무료",
    highlight: false,
  },
  {
    name: "Pro",
    detail: "무제한 프로젝트 · 100회/일 생성 · 프리미엄 내보내기",
    price: "₩29,000/월",
    highlight: true,
  },
  {
    name: "Enterprise",
    detail: "무제한 전부 · 우선 생성 · 전용 지원",
    price: "문의",
    highlight: false,
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0e0e0e] text-white">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 md:pb-24 md:pt-28">
        <p className="fade-in inline-flex rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-1 text-sm text-[#a3a3a3]">
          Splash · usesplash.vercel.app
        </p>
        <h1 className="fade-up mt-6 text-5xl font-bold leading-tight md:text-6xl">
          AI와 대화하면 로고가 완성됩니다
        </h1>
        <p className="fade-up mt-5 max-w-2xl text-lg text-[#b6b6b6]">
          브랜드, 스타일, 색상을 말하면 AI가 프로 로고를 디자인합니다. 수정도 대화로.
        </p>
        <div className="fade-up mt-8">
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl bg-[#4CAF50] px-6 py-3 text-base font-semibold text-black transition hover:brightness-110"
          >
            무료로 시작하기 →
          </Link>
          <p className="mt-3 text-sm text-[#9a9a9a]">무료 플랜 · 카드 불필요</p>
        </div>

        <div className="fade-up mt-12 rounded-2xl border border-[#2a2a2a] bg-[#141414] p-4 md:p-6">
          <div className="rounded-xl border border-[#2a2a2a] bg-[#101010] p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
              <div className="rounded-xl border border-[#2a2a2a] bg-[#171717] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#4CAF50]" />
                  <span className="text-sm text-[#cfcfcf]">Chat</span>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-5/6 rounded bg-[#2a2a2a]" />
                  <div className="h-3 w-4/6 rounded bg-[#232323]" />
                  <div className="h-3 w-5/6 rounded bg-[#2a2a2a]" />
                  <div className="h-3 w-3/6 rounded bg-[#232323]" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-9 flex-1 rounded-lg border border-[#2a2a2a] bg-[#111111]" />
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#4CAF50] font-bold text-black">
                    ▶
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[#2a2a2a] bg-[#171717] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#4CAF50]" />
                  <span className="text-sm text-[#cfcfcf]">Gallery Grid</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-lg border border-[#303030] bg-[#121212]" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="fade-up text-3xl font-bold md:text-4xl">작동 방식</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((step, idx) => (
            <article key={step.title} className="fade-up rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6" style={{ animationDelay: `${idx * 120}ms` }}>
              <div className="text-3xl">{step.emoji}</div>
              <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-[#b6b6b6]">{step.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="fade-up text-3xl font-bold md:text-4xl">핵심 기능</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {features.map((item, idx) => (
            <div key={item} className="fade-up rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5 text-[#dddddd]" style={{ animationDelay: `${idx * 70}ms` }}>
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="fade-up text-3xl font-bold md:text-4xl">요금제</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {pricing.map((plan, idx) => (
            <article
              key={plan.name}
              className={`fade-up rounded-2xl border p-6 ${
                plan.highlight
                  ? "border-[#4CAF50] bg-[#162117]"
                  : "border-[#2a2a2a] bg-[#1a1a1a]"
              }`}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <h3 className="text-2xl font-semibold">{plan.name}</h3>
              <p className="mt-3 text-[#bdbdbd]">{plan.detail}</p>
              <p className="mt-6 text-3xl font-bold text-[#4CAF50]">{plan.price}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 text-center">
        <h2 className="fade-up text-4xl font-bold">지금 바로 시작하세요</h2>
        <div className="fade-up mt-6">
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl bg-[#4CAF50] px-7 py-3 text-base font-semibold text-black transition hover:brightness-110"
          >
            무료로 시작하기 →
          </Link>
        </div>
        <footer className="mt-10 border-t border-[#2a2a2a] pt-6 text-sm text-[#8f8f8f]">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span>© {new Date().getFullYear()} Splash</span>
            <a href="https://usesplash.vercel.app" className="hover:text-white">usesplash.vercel.app</a>
          </div>
        </footer>
      </section>

      <style jsx global>{`
        .fade-in {
          animation: fadeIn 0.8s ease-out both;
        }
        .fade-up {
          animation: fadeUp 0.8s ease-out both;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  )
}
