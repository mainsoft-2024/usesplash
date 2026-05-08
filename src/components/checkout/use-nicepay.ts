"use client";

import { useCallback } from "react";

export type CheckoutSession = {
  orderId: string;
  amount: number;
  goodsName: string;
  clientId: string;
  returnUrl: string;
  buyerName?: string;
  buyerEmail?: string;
};

interface NicepaySdk {
  requestPay: (opts: Record<string, unknown>) => void;
}

interface WindowWithNicepay extends Window {
  AUTHNICE?: NicepaySdk;
}

/**
 * Wraps the global `AUTHNICE.requestPay` call so callers don't need to know
 * the SDK's option shape. Throws if the SDK script hasn't loaded yet.
 */
export function useNicepay() {
  const requestPay = useCallback((session: CheckoutSession) => {
    if (typeof window === "undefined") return;
    const sdk = (window as WindowWithNicepay).AUTHNICE;
    if (!sdk) {
      throw new Error("NICE 결제 모듈이 아직 로드되지 않았어요. 잠시 후 다시 시도해주세요.");
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
    });
  }, []);

  return { requestPay };
}
