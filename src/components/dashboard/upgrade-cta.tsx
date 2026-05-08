"use client";

import { trpc } from "@/lib/trpc/client";
import { CheckoutButton } from "@/components/checkout/checkout-button";

const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";

/**
 * Pro 업그레이드 CTA. 결제 기능이 비활성화돼 있거나 이미 Pro 사용자면 렌더하지 않음.
 * 무료 사용자에게는 잔여 일일 생성량을 보여주고 결제 흐름으로 유도.
 */
export function UpgradeCta() {
  const subscription = trpc.subscription.getCurrent.useQuery();

  if (!PAYMENTS_ENABLED) return null;
  if (!subscription.data) return null;
  if (subscription.data.tier !== "free") return null;

  const dailyRemaining = Math.max(0, 10 - (subscription.data.dailyGenerations ?? 0));

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        오늘 무료 생성 <span className="font-semibold">{dailyRemaining}회</span> 남았어요. Pro로 업그레이드하면 무제한이에요.
      </p>
      <CheckoutButton
        plan="monthly"
        className="rounded bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        Pro 시작하기
      </CheckoutButton>
    </div>
  );
}
