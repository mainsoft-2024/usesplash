import { env } from "@/lib/env";
import { getPricing } from "@/lib/payments/pricing";
import { CheckoutButton } from "@/components/checkout/checkout-button";
import { NicepayScript } from "@/components/checkout/nicepay-script";
import { PaymentsDisabledPlaceholder } from "@/components/payments-disabled-placeholder";

const FEATURES = [
  "무제한 로고 생성",
  "고해상도 다운로드 (PNG/SVG)",
  "백그라운드 자동 제거",
  "AI 채팅으로 로고 수정",
  "프로젝트 무제한 저장",
  "우선 지원",
];

function formatKrw(value: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export default function PricingPage({ searchParams }: { searchParams: { plan?: string } }) {
  if (!env.NEXT_PUBLIC_PAYMENTS_ENABLED || env.NEXT_PUBLIC_PAYMENTS_ENABLED === "false") {
    return <PaymentsDisabledPlaceholder />;
  }

  const pricing = getPricing();
  const activePlan: "monthly" | "yearly" = searchParams.plan === "yearly" ? "yearly" : "monthly";
  const yearlySavingsKrw = pricing.monthly * 12 - pricing.yearly;

  return (
    <>
      <NicepayScript jsSdkUrl={env.NICEPAY_JS_SDK_URL} />

      <main className="mx-auto max-w-5xl px-6 py-16">
        <header className="mb-12 text-center">
          <h1 className="text-3xl font-semibold sm:text-4xl">Splash Pro</h1>
          <p className="mt-3 text-[var(--text-secondary)]">AI와 함께 무제한으로 로고를 만드세요. VAT 포함.</p>
        </header>

        <nav className="mx-auto mb-10 flex w-fit rounded-full border border-[var(--border-primary)] p-1 text-sm">
          <a
            href="/pricing?plan=monthly"
            className={`rounded-full px-5 py-2 transition ${activePlan === "monthly" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-secondary)]"}`}
          >
            월간
          </a>
          <a
            href="/pricing?plan=yearly"
            className={`rounded-full px-5 py-2 transition ${activePlan === "yearly" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-secondary)]"}`}
          >
            연간 <span className="ml-1 text-xs">2개월 할인</span>
          </a>
        </nav>

        <div className="mx-auto max-w-md rounded-2xl border border-[var(--border-primary)] p-8 shadow-sm">
          <p className="text-sm text-[var(--text-secondary)]">
            {activePlan === "monthly" ? "월간 결제" : "연간 결제"}
          </p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-semibold">
              {formatKrw(activePlan === "monthly" ? pricing.monthly : pricing.yearly)}
            </span>
            <span className="text-sm text-[var(--text-secondary)]">/ {activePlan === "monthly" ? "월" : "년"}</span>
          </p>
          {activePlan === "yearly" ? (
            <p className="mt-1 text-sm text-emerald-600">월간 대비 {formatKrw(yearlySavingsKrw)} 절약</p>
          ) : null}

          <ul className="mt-6 space-y-2 text-sm">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <span aria-hidden="true">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <CheckoutButton
            plan={activePlan}
            className="mt-8 w-full rounded-lg bg-[var(--accent-primary)] px-4 py-3 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            가입하기
          </CheckoutButton>

          <p className="mt-3 text-center text-xs text-[var(--text-tertiary)]">
            결제 시 <a href="/terms" className="underline">이용약관</a> 및{" "}
            <a href="/refund-policy" className="underline">환불 정책</a>에 동의합니다.
          </p>
        </div>
      </main>
    </>
  );
}
