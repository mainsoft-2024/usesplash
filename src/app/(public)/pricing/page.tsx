import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "요금제" }

const plans = [
  {
    name: "Free",
    price: "₩0",
    period: "영구 무료",
    features: ["프로젝트 3개", "일일 생성 10회", "기본 내보내기 (PNG)", "AI 인터뷰", "버전 관리"],
    cta: "무료로 시작",
    href: "/login",
    featured: false,
  },
  {
    name: "Pro",
    price: "₩19,900",
    period: "/월",
    features: ["무제한 프로젝트", "일일 생성 100회", "프리미엄 내보내기 (SVG, 배경제거)", "AI 인터뷰", "버전 관리", "우선 생성 큐", "고해상도 출력"],
    cta: "Pro 시작하기",
    href: "mailto:hello@usesplash.vercel.app",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "맞춤",
    period: "견적 문의",
    features: ["무제한 모든 기능", "전용 지원", "SLA 보장", "커스텀 브랜딩", "API 액세스", "팀 관리"],
    cta: "문의하기",
    href: "mailto:hello@usesplash.vercel.app",
    featured: false,
  },
]

const comparison = [
  { feature: "프로젝트 수", free: "3개", pro: "무제한", enterprise: "무제한" },
  { feature: "일일 생성", free: "10회", pro: "100회", enterprise: "무제한" },
  { feature: "PNG 내보내기", free: "✓", pro: "✓", enterprise: "✓" },
  { feature: "SVG 변환", free: "—", pro: "✓", enterprise: "✓" },
  { feature: "배경 제거", free: "—", pro: "✓", enterprise: "✓" },
  { feature: "고해상도 출력", free: "—", pro: "✓", enterprise: "✓" },
  { feature: "우선 생성 큐", free: "—", pro: "✓", enterprise: "✓" },
  { feature: "전용 지원", free: "—", pro: "—", enterprise: "✓" },
  { feature: "API 액세스", free: "—", pro: "—", enterprise: "✓" },
]

const faqs = [
  { q: "결제는 어떻게 하나요?", a: "현재 Pro 플랜은 문의를 통해 결제 링크를 안내드리고 있습니다. 곧 자동 결제 시스템이 도입될 예정입니다." },
  { q: "무료 플랜에서 Pro로 업그레이드하면 데이터는 유지되나요?", a: "네, 모든 프로젝트와 로고가 그대로 유지됩니다." },
  { q: "환불 정책은 어떻게 되나요?", a: "결제 후 7일 이내 환불이 가능합니다. hello@usesplash.vercel.app으로 문의해주세요." },
  { q: "Enterprise 플랜은 어떤 경우에 필요한가요?", a: "대규모 팀, SLA가 필요한 비즈니스, 또는 API를 통한 커스텀 통합이 필요한 경우에 적합합니다." },
]

export default function PricingPage() {
  return (
    <div className="bg-[var(--bg-primary)]">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold md:text-5xl">당신에게 맞는 요금제를 선택하세요</h1>
        <p className="mx-auto mt-4 max-w-lg text-[var(--text-secondary)]">모든 플랜에 AI 인터뷰와 버전 관리가 포함되어 있습니다.</p>
      </section>

      {/* Cards */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border p-6 ${plan.featured ? "border-[var(--accent-green)] bg-gradient-to-b from-[#15341d] to-[var(--bg-secondary)]" : "border-[var(--border-primary)] bg-[var(--bg-secondary)]"}`}
            >
              {plan.featured && <p className="mb-2 text-xs font-medium text-[var(--accent-green)]">가장 인기</p>}
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <div className="mt-3">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="ml-1 text-sm text-[var(--text-secondary)]">{plan.period}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="mt-0.5 text-[var(--accent-green)]">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 block rounded-xl py-3 text-center text-sm font-medium transition ${plan.featured ? "bg-[var(--accent-green)] text-black hover:bg-[var(--accent-green-hover)]" : "border border-[var(--border-primary)] text-[var(--text-primary)] hover:border-[var(--accent-green)] hover:text-[var(--accent-green)]"}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <h2 className="mb-8 text-center text-2xl font-semibold">상세 비교</h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--border-primary)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <th className="px-3 sm:px-6 py-4 text-left font-medium text-[var(--text-secondary)]">기능</th>
                <th className="px-3 sm:px-6 py-4 text-center font-medium">Free</th>
                <th className="px-3 sm:px-6 py-4 text-center font-medium text-[var(--accent-green)]">Pro</th>
                <th className="px-3 sm:px-6 py-4 text-center font-medium">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr key={row.feature} className={i < comparison.length - 1 ? "border-b border-[var(--border-primary)]" : ""}>
                  <td className="px-3 sm:px-6 py-3 text-[var(--text-secondary)]">{row.feature}</td>
                  <td className="px-3 sm:px-6 py-3 text-center">{row.free}</td>
                  <td className="px-3 sm:px-6 py-3 text-center">{row.pro}</td>
                  <td className="px-3 sm:px-6 py-3 text-center">{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-8 text-center text-2xl font-semibold">자주 묻는 질문</h2>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <details key={faq.q} className="group rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
              <summary className="cursor-pointer px-6 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                {faq.q}
              </summary>
              <p className="px-6 pb-4 text-sm text-[var(--text-secondary)]">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
