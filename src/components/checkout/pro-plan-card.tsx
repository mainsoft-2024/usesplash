"use client";

import { useState } from "react";
import { CheckoutButton } from "./checkout-button";

type Props = {
  monthlyKrw: number;
  yearlyKrw: number;
  features: readonly string[];
  paymentsEnabled: boolean;
};

function formatKrw(value: number): string {
  return `₩${new Intl.NumberFormat("ko-KR").format(value)}`;
}

export function ProPlanCard({ monthlyKrw, yearlyKrw, features, paymentsEnabled }: Props) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const price = billing === "monthly" ? monthlyKrw : yearlyKrw;
  const periodLabel = billing === "monthly" ? "/월" : "/년";
  const monthlyEquivOfYear = Math.round(yearlyKrw / 12);
  const yearlySavings = monthlyKrw * 12 - yearlyKrw;

  return (
    <div className="flex flex-col rounded-2xl border border-[var(--accent-green)] bg-gradient-to-b from-[#15341d] to-[var(--bg-secondary)] p-6">
      <p className="mb-2 text-xs font-medium text-[var(--accent-green)]">가장 인기</p>
      <h2 className="text-xl font-semibold">Pro</h2>

      {/* 월/연 토글 */}
      <div
        role="tablist"
        aria-label="결제 주기"
        className="mt-4 inline-flex items-center gap-1 self-start rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-1 text-xs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={billing === "monthly"}
          onClick={() => setBilling("monthly")}
          className={`rounded-full px-3 py-1 font-medium transition ${
            billing === "monthly"
              ? "bg-[var(--accent-green)] text-black"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          월간
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={billing === "yearly"}
          onClick={() => setBilling("yearly")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition ${
            billing === "yearly"
              ? "bg-[var(--accent-green)] text-black"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          연간
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              billing === "yearly" ? "bg-black/15 text-black" : "bg-[var(--accent-green)]/20 text-[var(--accent-green)]"
            }`}
          >
            2개월 ↓
          </span>
        </button>
      </div>

      <div className="mt-4">
        <span className="text-3xl font-bold">{formatKrw(price)}</span>
        <span className="ml-1 text-sm text-[var(--text-secondary)]">{periodLabel}</span>
      </div>

      <p className="mt-1 min-h-[20px] text-xs text-[var(--accent-green)]">
        {billing === "yearly"
          ? `월 ${formatKrw(monthlyEquivOfYear)} 꼴 · 연 ${formatKrw(yearlySavings)} 절약`
          : "매월 자동 결제 · 언제든 해지 가능"}
      </p>

      <ul className="mt-5 flex-1 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <span className="mt-0.5 text-[var(--accent-green)]">✓</span> {f}
          </li>
        ))}
      </ul>

      {paymentsEnabled ? (
        <CheckoutButton
          plan={billing}
          className="mt-8 block rounded-xl bg-[var(--accent-green)] py-3 text-center text-sm font-semibold text-black transition hover:bg-[var(--accent-green-hover)] disabled:opacity-50"
        >
          {billing === "monthly" ? "월간으로 시작" : "연간으로 시작"}
        </CheckoutButton>
      ) : (
        <a
          href="/login"
          className="mt-8 block rounded-xl bg-[var(--accent-green)] py-3 text-center text-sm font-semibold text-black transition hover:bg-[var(--accent-green-hover)]"
        >
          Pro 시작하기
        </a>
      )}

      <p className="mt-3 text-center text-[10px] text-[var(--text-tertiary)]">
        결제 시 <a href="/terms" className="underline">이용약관</a> 및{" "}
        <a href="/refund-policy" className="underline">환불 정책</a>에 동의
      </p>
    </div>
  );
}
