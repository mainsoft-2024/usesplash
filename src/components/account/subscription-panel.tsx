"use client";

import { trpc } from "@/lib/trpc/client";
import { CancelButton } from "./cancel-button";

const TIER_LABEL: Record<string, string> = { free: "무료", pro: "Pro" };
const STATE_LABEL: Record<string, string> = {
  free: "무료",
  active: "이용 중",
  pending_retry: "결제 재시도 중",
  canceled_grace: "해지 예정",
  expired: "만료됨",
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function SubscriptionPanel() {
  const query = trpc.subscription.getCurrent.useQuery();

  if (query.isLoading) {
    return <p className="text-sm text-[var(--text-secondary)]">구독 정보를 불러오는 중...</p>;
  }

  const sub = query.data;
  if (!sub) {
    return <p className="text-sm text-[var(--text-secondary)]">구독 정보가 없어요.</p>;
  }

  return (
    <section className="rounded-lg border border-[var(--border-primary)] p-6">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">구독 상태</h2>
        <span className="text-sm text-[var(--text-secondary)]">{STATE_LABEL[sub.billingState] ?? sub.billingState}</span>
      </header>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--text-secondary)]">요금제</dt>
          <dd className="mt-1 font-medium">{TIER_LABEL[sub.tier] ?? sub.tier}</dd>
        </div>
        <div>
          <dt className="text-[var(--text-secondary)]">다음 결제일</dt>
          <dd className="mt-1 font-medium">{formatDate(sub.nextBillingDate)}</dd>
        </div>
        {sub.cancelEffectiveAt ? (
          <div className="sm:col-span-2">
            <dt className="text-[var(--text-secondary)]">이용 가능 기한</dt>
            <dd className="mt-1 font-medium">{formatDate(sub.cancelEffectiveAt)}까지 이용 가능</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4">
        <CancelButton billingState={sub.billingState} />
      </div>
    </section>
  );
}
