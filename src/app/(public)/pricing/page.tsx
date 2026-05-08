import type { Metadata } from "next";
import Link from "next/link";
import { env } from "@/lib/env";
import { getPricing } from "@/lib/payments/pricing";
import { NicepayScript } from "@/components/checkout/nicepay-script";
import { ProPlanCard } from "@/components/checkout/pro-plan-card";

export const metadata: Metadata = { title: "요금제" };

const PRO_FEATURES = [
  "무제한 프로젝트",
  "일일 생성 100회",
  "프리미엄 내보내기 (SVG, 배경제거)",
  "AI 인터뷰",
  "버전 관리",
  "우선 생성 큐",
  "고해상도 출력",
] as const;

const FREE_FEATURES = [
  "프로젝트 3개",
  "일일 생성 10회",
  "기본 내보내기 (PNG)",
  "AI 인터뷰",
  "버전 관리",
] as const;

const ENTERPRISE_FEATURES = [
  "무제한 모든 기능",
  "전용 지원",
  "SLA 보장",
  "커스텀 브랜딩",
  "API 액세스",
  "팀 관리",
] as const;

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
];

const faqs = [
  { q: "결제는 어떻게 하나요?", a: "월간(₩19,900) 또는 연간(₩199,000, 2개월 무료) 플랜을 선택해 신용카드로 즉시 결제할 수 있습니다. 정기결제로 자동 갱신되며 언제든지 해지 가능합니다." },
  { q: "무료 플랜에서 Pro로 업그레이드하면 데이터는 유지되나요?", a: "네, 모든 프로젝트와 로고가 그대로 유지됩니다." },
  { q: "환불 정책은 어떻게 되나요?", a: "결제 후 7일 이내, 사용 이력이 없는 경우 계정 페이지에서 즉시 환불 요청할 수 있습니다." },
  { q: "Enterprise 플랜은 어떤 경우에 필요한가요?", a: "대규모 팀, SLA가 필요한 비즈니스, 또는 API를 통한 커스텀 통합이 필요한 경우에 적합합니다." },
];

export default function PricingPage() {
  const paymentsEnabled = env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";
  const pricing = getPricing();

  return (
    <div className="bg-[var(--bg-primary)]">
      {paymentsEnabled ? <NicepayScript jsSdkUrl={env.NICEPAY_JS_SDK_URL} /> : null}

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold md:text-5xl">당신에게 맞는 요금제를 선택하세요</h1>
        <p className="mx-auto mt-4 max-w-lg text-[var(--text-secondary)]">
          모든 플랜에 AI 인터뷰와 버전 관리가 포함되어 있습니다.
        </p>
      </section>

      {/* Cards */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Free */}
          <div className="flex flex-col rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
            <h2 className="text-xl font-semibold">Free</h2>
            <div className="mt-3">
              <span className="text-3xl font-bold">₩0</span>
              <span className="ml-1 text-sm text-[var(--text-secondary)]">영구 무료</span>
            </div>
            <ul className="mt-6 flex-1 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="mt-0.5 text-[var(--accent-green)]">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="mt-8 block rounded-xl border border-[var(--border-primary)] py-3 text-center text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent-green)] hover:text-[var(--accent-green)]"
            >
              무료로 시작
            </Link>
          </div>

          {/* Pro — 클라이언트 컴포넌트 (월/연 토글 + 결제) */}
          <ProPlanCard
            monthlyKrw={pricing.monthly}
            yearlyKrw={pricing.yearly}
            features={PRO_FEATURES}
            paymentsEnabled={paymentsEnabled}
          />

          {/* Enterprise */}
          <div className="flex flex-col rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
            <h2 className="text-xl font-semibold">Enterprise</h2>
            <div className="mt-3">
              <span className="text-3xl font-bold">맞춤</span>
              <span className="ml-1 text-sm text-[var(--text-secondary)]">견적 문의</span>
            </div>
            <ul className="mt-6 flex-1 space-y-3">
              {ENTERPRISE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="mt-0.5 text-[var(--accent-green)]">✓</span> {f}
                </li>
              ))}
            </ul>
            <a
              href="mailto:hello@splash.ai.kr"
              className="mt-8 block rounded-xl border border-[var(--border-primary)] py-3 text-center text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent-green)] hover:text-[var(--accent-green)]"
            >
              문의하기
            </a>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <h2 className="mb-8 text-center text-2xl font-semibold">상세 비교</h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--border-primary)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <th className="px-6 py-4 text-left font-medium text-[var(--text-secondary)]">기능</th>
                <th className="px-6 py-4 text-center font-medium">Free</th>
                <th className="px-6 py-4 text-center font-medium text-[var(--accent-green)]">Pro</th>
                <th className="px-6 py-4 text-center font-medium">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr key={row.feature} className={i < comparison.length - 1 ? "border-b border-[var(--border-primary)]" : ""}>
                  <td className="px-6 py-3 text-[var(--text-secondary)]">{row.feature}</td>
                  <td className="px-6 py-3 text-center">{row.free}</td>
                  <td className="px-6 py-3 text-center">{row.pro}</td>
                  <td className="px-6 py-3 text-center">{row.enterprise}</td>
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
  );
}
