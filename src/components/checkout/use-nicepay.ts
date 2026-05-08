"use client";

import { useCallback } from "react";
import { toast } from "sonner";

export type CheckoutSession = {
  orderId: string;
  amount: number;
  goodsName: string;
  clientId: string;
  returnUrl: string;
  buyerName?: string;
  buyerEmail?: string;
};

interface NicepayErrorResult {
  msg?: string;
  errorMsg?: string;
}

interface NicepaySdk {
  requestPay: (opts: Record<string, unknown>) => void;
}

interface WindowWithNicepay extends Window {
  AUTHNICE?: NicepaySdk;
}

/**
 * Wraps `AUTHNICE.requestPay` from the NICE Pay v2 JS SDK. Conforms to NICE's
 * required parameter set including the mandatory `fnError` callback.
 *
 * Reference: https://github.com/nicepayments/nicepay-manual (Server 승인 모델)
 */
export function useNicepay() {
  const requestPay = useCallback((session: CheckoutSession) => {
    if (typeof window === "undefined") return;
    const sdk = (window as WindowWithNicepay).AUTHNICE;
    if (!sdk) {
      toast.error("NICE 결제 모듈이 아직 로드되지 않았어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    sdk.requestPay({
      clientId: session.clientId,
      method: "card",
      orderId: session.orderId,
      amount: session.amount,
      goodsName: session.goodsName,
      returnUrl: session.returnUrl,
      buyerName: session.buyerName,
      buyerEmail: session.buyerEmail,
      fnError: (result: NicepayErrorResult) => {
        const userMsg = result?.msg ?? "결제 진행 중 오류가 발생했어요.";
        const devMsg = result?.errorMsg ?? "";
        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.error("[nicepay] fnError", result);
        }
        toast.error(devMsg ? `${userMsg} (${devMsg})` : userMsg);
      },
    });
  }, []);

  return { requestPay };
}
