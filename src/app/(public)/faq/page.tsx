"use client"

import { useState } from "react"

const categories = ["전체", "일반", "요금제", "로고 생성", "계정"] as const

const faqs: { category: string; q: string; a: string }[] = [
  { category: "일반", q: "Splash는 무엇인가요?", a: "Splash는 AI와의 대화를 통해 로고를 생성하고 수정할 수 있는 디자인 플랫폼입니다. 복잡한 디자인 도구 없이도 전문가 수준의 로고를 만들 수 있습니다." },
  { category: "일반", q: "어떤 AI 기술을 사용하나요?", a: "Google Gemini 기반의 이미지 생성 AI와 대화형 AI를 결합하여 사용합니다. 자연어로 요구사항을 전달하면 AI가 이해하고 로고를 생성합니다." },
  { category: "일반", q: "회원가입은 어떻게 하나요?", a: "Google 계정으로 간편하게 로그인할 수 있습니다. 별도의 회원가입 절차가 필요 없습니다." },
  { category: "요금제", q: "무료 플랜으로 무엇을 할 수 있나요?", a: "무료 플랜에서는 3개의 프로젝트를 만들고, 하루 10회의 로고 생성이 가능합니다. PNG 형식으로 내보내기할 수 있습니다." },
  { category: "요금제", q: "Pro 플랜으로 업그레이드하면 무엇이 달라지나요?", a: "무제한 프로젝트, 하루 100회 생성, SVG 변환, 배경 제거, 고해상도 출력 등 프리미엄 기능을 이용할 수 있습니다." },
  { category: "요금제", q: "환불이 가능한가요?", a: "결제 후 7일 이내에 환불 요청이 가능합니다. hello@usesplash.vercel.app으로 문의해주세요." },
  { category: "로고 생성", q: "한 번에 몇 개의 시안을 받을 수 있나요?", a: "한 번의 요청으로 최대 5개의 시안을 동시에 생성할 수 있습니다. 갤러리에서 비교하고 마음에 드는 것을 선택하세요." },
  { category: "로고 생성", q: "생성된 로고를 수정할 수 있나요?", a: "네, 자연어로 수정 요청을 할 수 있습니다. 예: '색상을 파란색으로 바꿔줘', '텍스트를 더 크게 해줘'. 수정본은 버전으로 관리됩니다." },
  { category: "로고 생성", q: "어떤 형식으로 내보내기할 수 있나요?", a: "PNG (기본), SVG 벡터 (Pro), 배경 제거 PNG (Pro) 형식으로 내보내기할 수 있습니다. 크롭 기능도 제공됩니다." },
  { category: "계정", q: "여러 기기에서 사용할 수 있나요?", a: "네, Google 계정으로 로그인하면 어떤 기기에서든 프로젝트에 접근할 수 있습니다." },
  { category: "계정", q: "계정을 삭제하고 싶어요.", a: "hello@usesplash.vercel.app으로 계정 삭제를 요청해주세요. 모든 데이터가 영구적으로 삭제됩니다." },
]

export default function FaqPage() {
  const [active, setActive] = useState<string>("전체")
  const filtered = active === "전체" ? faqs : faqs.filter((f) => f.category === active)

  return (
    <div className="bg-[var(--bg-primary)]">
      <section className="mx-auto max-w-6xl px-6 py-24">
        <h1 className="text-center text-4xl font-bold md:text-5xl">자주 묻는 질문</h1>
        <p className="mx-auto mt-4 max-w-lg text-center text-[var(--text-secondary)]">
          궁금한 점이 있으신가요? 아래에서 답을 찾아보세요.
        </p>

        <div className="mt-12 flex flex-col gap-8 md:flex-row">
          {/* Categories */}
          <nav className="flex flex-row gap-2 overflow-x-auto md:w-48 md:flex-shrink-0 md:flex-col md:overflow-visible">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm transition-colors ${
                  active === cat
                    ? "bg-[var(--accent-green)] font-medium text-black"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </nav>

          {/* Q&A */}
          <div className="flex-1 space-y-3">
            {filtered.map((faq) => (
              <details key={faq.q} className="group rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <summary className="cursor-pointer px-6 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  {faq.q}
                </summary>
                <p className="px-6 pb-4 text-sm leading-relaxed text-[var(--text-secondary)]">{faq.a}</p>
              </details>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">해당 카테고리에 질문이 없습니다.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}