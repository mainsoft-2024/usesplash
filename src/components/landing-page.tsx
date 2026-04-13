import Link from "next/link"

const steps = [
  { icon: "💬", title: "AI와 대화", description: "브랜드명, 스타일, 색상을 자연어로 알려주세요" },
  { icon: "🎨", title: "시안 생성", description: "AI가 다양한 로고 시안을 즉시 만들어 드립니다" },
  { icon: "✏️", title: "수정 & 완성", description: "원하는 시안을 선택하고 자연어로 수정 요청하세요" },
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
  { name: "Free", detail: "3 프로젝트 · 10회/일 생성 · 기본 내보내기", cta: "무료로 시작", href: "/login", featured: false },
  { name: "Pro", detail: "무제한 프로젝트 · 100회/일 생성 · 프리미엄 내보내기", cta: "문의하기", href: "mailto:hello@usesplash.vercel.app", featured: true },
  { name: "Enterprise", detail: "무제한 · 우선 생성 · 전용 지원", cta: "문의하기", href: "mailto:hello@usesplash.vercel.app", featured: false },
] as const

export function LandingPage({ session }: { session: any }) {
  const isLoggedIn = !!session?.user

  return (
    <div className="bg-[var(--bg-primary)]">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-16 text-center">
        <p className="mb-6 inline-block rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-1.5 text-xs text-[var(--text-secondary)]">
          AI 기반 로고 디자인 스튜디오
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          AI와 대화하며{"\n"}나만의 로고를 완성하세요
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-[var(--text-secondary)]">
          복잡한 디자인 툴 없이, 채팅만으로 전문가 수준의 로고를 만들어냅니다.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          {isLoggedIn ? (
            <Link href="/projects" className="rounded-xl bg-[var(--accent-green)] px-8 py-3 font-medium text-black transition hover:bg-[var(--accent-green-hover)]">
              대시보드로 이동
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-xl bg-[var(--accent-green)] px-8 py-3 font-medium text-black transition hover:bg-[var(--accent-green-hover)]">
                무료로 시작하기
              </Link>
              <span className="text-sm text-[var(--text-muted)]">3개 프로젝트 무료 · 신용카드 불필요</span>
            </>
          )}
        </div>

        {/* Mock UI */}
        <div className="relative mx-auto mt-16 max-w-4xl">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-[#4CAF50]/20 to-teal-400/10 blur-3xl" />
          <div className="relative rounded-3xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 shadow-2xl">
            <div className="mb-3 flex items-center gap-2 text-xs text-[var(--text-dim)]">
              <span className="h-2 w-2 rounded-full bg-[var(--text-muted)]" />
              <span className="h-2 w-2 rounded-full bg-[var(--text-muted)]" />
              <span className="h-2 w-2 rounded-full bg-[var(--text-muted)]" />
              2패널 워크스페이스
            </div>
            <div className="grid h-[340px] grid-cols-[1fr_1.2fr] gap-3">
              <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
                <div className="mb-2 h-8 rounded-lg bg-[var(--bg-tertiary)]" />
                <div className="space-y-2">
                  <div className="h-10 rounded-lg bg-[var(--bg-secondary)]" />
                  <div className="ml-6 h-10 rounded-lg bg-[#17311d]" />
                  <div className="h-10 rounded-lg bg-[var(--bg-secondary)]" />
                  <div className="ml-8 h-10 rounded-lg bg-[#17311d]" />
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="aspect-square rounded-xl bg-gradient-to-br from-[var(--border-primary)] to-[var(--bg-secondary)]" />
                  <div className="aspect-square rounded-xl bg-gradient-to-br from-[#21462a] to-[#142b1a]" />
                  <div className="aspect-square rounded-xl bg-gradient-to-br from-[var(--border-primary)] to-[var(--bg-secondary)]" />
                  <div className="aspect-square rounded-xl bg-gradient-to-br from-[var(--border-primary)] to-[var(--bg-secondary)]" />
                </div>
                <div className="h-7 w-28 rounded-full bg-[#17311d]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-center text-3xl font-semibold">작동 방식</h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-[var(--text-secondary)]">세 단계로 완성하는 프로페셔널 로고</p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <article key={step.title} className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6 transition-colors hover:border-[var(--border-secondary)]">
              <div className="mb-3 text-2xl">{step.icon}</div>
              <p className="mb-1 text-xs font-medium text-[var(--accent-green)]">0{i + 1}</p>
              <h3 className="text-lg font-medium">{step.title}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-center text-3xl font-semibold">핵심 기능</h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-[var(--text-secondary)]">로고 디자인에 필요한 모든 것</p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([icon, title, desc]) => (
            <article key={title} className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6 transition-colors hover:border-[var(--border-secondary)]">
              <div className="mb-2 text-2xl">{icon}</div>
              <h3 className="font-medium">{title}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-center text-3xl font-semibold">요금제</h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-[var(--text-secondary)]">당신에게 맞는 플랜을 선택하세요</p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {pricing.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-2xl border p-6 transition-colors ${
                plan.featured
                  ? "border-[var(--accent-green)] bg-gradient-to-b from-[#15341d] to-[var(--bg-secondary)]"
                  : "border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--border-secondary)]"
              }`}
            >
              {plan.featured && <p className="mb-2 text-xs font-medium text-[var(--accent-green)]">인기</p>}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <ul className="mt-5 space-y-2 text-sm text-[var(--text-secondary)]">
                {plan.detail.split(" · ").map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="text-[var(--accent-green)]">✓</span> {item}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-6 inline-block rounded-xl px-5 py-2.5 text-sm font-medium transition ${
                  plan.featured
                    ? "bg-[var(--accent-green)] text-black hover:bg-[var(--accent-green-hover)]"
                    : "border border-[var(--border-primary)] text-[var(--text-primary)] hover:border-[var(--accent-green)] hover:text-[var(--accent-green)]"
                }`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-[var(--text-muted)]">
          <Link href="/pricing" className="text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]">요금제 전체 보기 →</Link>
        </p>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold">지금 바로 당신의 브랜드를 시각화하세요</h2>
        <p className="mx-auto mt-4 max-w-md text-[var(--text-secondary)]">AI가 당신의 아이디어를 로고로 만들어 드립니다.</p>
        <div className="mt-8">
          {isLoggedIn ? (
            <Link href="/projects" className="rounded-xl bg-[var(--accent-green)] px-8 py-3 font-medium text-black transition hover:bg-[var(--accent-green-hover)]">
              대시보드로 이동
            </Link>
          ) : (
            <Link href="/login" className="rounded-xl bg-[var(--accent-green)] px-8 py-3 font-medium text-black transition hover:bg-[var(--accent-green-hover)]">
              무료로 시작하기
            </Link>
          )}
        </div>
      </section>
    </div>
  )
}