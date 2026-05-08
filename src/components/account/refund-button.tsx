"use client";

import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

type Props = { paymentId: string; eligible: boolean };

export function RefundButton({ paymentId, eligible }: Props) {
  const utils = trpc.useUtils();
  const refund = trpc.payment.requestRefund.useMutation({
    onError: (err) => toast.error(err.message),
    onSuccess: () => {
      toast.success("환불 요청을 처리했어요.");
      void utils.payment.listPayments.invalidate();
    },
  });

  if (!eligible) {
    return <span className="text-xs text-[var(--text-tertiary)]">기간 만료</span>;
  }

  return (
    <button
      type="button"
      disabled={refund.isPending}
      onClick={() => {
        if (!window.confirm("환불을 요청하시겠어요? 환불은 결제일로부터 7일 이내, 사용 이력이 없을 때만 가능해요.")) return;
        refund.mutate({ paymentId });
      }}
      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
    >
      {refund.isPending ? "처리 중..." : "환불 요청"}
    </button>
  );
}
