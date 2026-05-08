"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { useNicepay } from "./use-nicepay";

type Props = {
  plan: "monthly" | "yearly";
  className?: string;
  children: ReactNode;
};

export function CheckoutButton({ plan, className, children }: Props) {
  const router = useRouter();
  const { requestPay } = useNicepay();
  const [pending, setPending] = useState(false);

  const createSession = trpc.payment.createCheckoutSession.useMutation({
    onError: (err) => {
      if (err.data?.code === "UNAUTHORIZED") {
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      toast.error(err.message);
    },
    onSuccess: (session) => {
      try {
        requestPay(session);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "결제 모듈 호출에 실패했어요.");
      } finally {
        setPending(false);
      }
    },
  });

  return (
    <button
      type="button"
      disabled={pending || createSession.isPending}
      onClick={() => {
        setPending(true);
        createSession.mutate({ plan });
      }}
      className={className}
    >
      {pending || createSession.isPending ? "처리 중..." : children}
    </button>
  );
}
