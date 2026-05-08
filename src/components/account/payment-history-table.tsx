"use client";

import { trpc } from "@/lib/trpc/client";
import { RefundButton } from "./refund-button";

const STATUS_LABEL: Record<string, string> = {
  pending: "결제 대기",
  paid: "결제 완료",
  completed: "결제 완료",
  failed: "결제 실패",
  refunded: "환불됨",
  suspicious: "확인 필요",
};



function formatKrw(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function nicepayReceiptUrl(tid: string | null): string | null {
  if (!tid) return null;
  return `https://npg.nicepay.co.kr/issue/IssueLoader.do?Tid=${encodeURIComponent(tid)}`;
}

export function PaymentHistoryTable() {
  const query = trpc.payment.listPayments.useInfiniteQuery(
    { limit: 20 },
    { getNextPageParam: (last) => last.nextCursor },
  );

  if (query.isLoading) {
    return <p className="text-sm text-[var(--text-secondary)]">불러오는 중...</p>;
  }

  const rows = query.data?.pages.flatMap((p) => p.items) ?? [];


  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)]">결제 내역이 없어요.</p>;
  }

  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--border-primary)] text-left text-[var(--text-secondary)]">
          <tr>
            <th className="py-2 font-medium">날짜</th>
            <th className="py-2 font-medium">금액</th>
            <th className="py-2 font-medium">상태</th>
            <th className="py-2 font-medium">영수증</th>
            <th className="py-2 font-medium">환불</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const eligible = p.status === "paid" || p.status === "completed";
            const receipt = nicepayReceiptUrl(p.providerPaymentId);
            return (
              <tr key={p.id} className="border-b border-[var(--border-primary)]/40">
                <td className="py-2">{formatDate(p.createdAt)}</td>
                <td className="py-2">{formatKrw(p.amount)}</td>
                <td className="py-2">{STATUS_LABEL[p.status] ?? p.status}</td>
                <td className="py-2">
                  {receipt ? (
                    <a href={receipt} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      보기
                    </a>
                  ) : (
                    <span className="text-[var(--text-tertiary)]">-</span>
                  )}
                </td>
                <td className="py-2">
                  <RefundButton paymentId={p.id} eligible={eligible} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {query.hasNextPage ? (
        <button
          type="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
          className="text-sm text-[var(--text-secondary)] hover:underline disabled:opacity-50"
        >
          {query.isFetchingNextPage ? "불러오는 중..." : "더 보기"}
        </button>
      ) : null}
    </div>
  );
}
