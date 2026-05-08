"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

const STATE_LABELS: Record<string, string> = {
  active: "이용 중",
  canceled_grace: "해지 예정",
  pending_retry: "결제 재시도 중",
  expired: "만료됨",
  free: "무료",
};

type Props = { billingState: string };

export function CancelButton({ billingState }: Props) {
  const utils = trpc.useUtils();
  const [confirming, setConfirming] = useState(false);

  const cancel = trpc.payment.cancelSubscription.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success("해지 요청을 받았어요. 다음 결제일까지 Pro를 계속 이용할 수 있어요.");
      void utils.invalidate();
    },
  });

  const uncancel = trpc.payment.uncancelSubscription.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success("해지를 취소했어요.");
      void utils.invalidate();
    },
  });

  if (billingState === "canceled_grace") {
    return (
      <button
        type="button"
        disabled={uncancel.isPending}
        onClick={() => uncancel.mutate()}
        className="rounded border border-[var(--border-primary)] px-4 py-2 text-sm hover:bg-[var(--bg-hover)] disabled:opacity-50"
      >
        {uncancel.isPending ? "처리 중..." : "해지 취소"}
      </button>
    );
  }

  if (billingState !== "active") {
    return <span className="text-sm text-[var(--text-secondary)]">{STATE_LABELS[billingState] ?? billingState}</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-[var(--text-secondary)] underline-offset-2 hover:underline"
      >
        구독 해지
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-[var(--border-primary)] p-3 text-sm">
      <p>정말 해지하시겠어요? 다음 결제일까지 Pro 기능을 계속 이용할 수 있어요.</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate()}
          className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {cancel.isPending ? "처리 중..." : "해지 확정"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded border border-[var(--border-primary)] px-3 py-1"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
