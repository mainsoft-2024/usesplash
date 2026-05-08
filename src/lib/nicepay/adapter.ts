import type { NicepayApprovalResponse, ProviderPaymentResult } from "./types";

/** Maps NICEPAY approval response into ProviderPaymentResult. */
export function toProviderPaymentResult(raw: NicepayApprovalResponse): ProviderPaymentResult {
  return {
    orderId: raw.orderId,
    providerPaymentId: raw.tid,
    providerTransactionId: raw.tid,
    status: raw.resultCode === "0000" ? "paid" : "failed",
    amount: raw.amount,
    currency: "KRW",
    errorCode: raw.resultCode === "0000" ? undefined : raw.resultCode,
    errorMessage: raw.resultCode === "0000" ? undefined : raw.resultMsg,
    receiptUrl: raw.receiptUrl,
    paymentMethod: "card",
    paidAt: raw.paidAt ? new Date(raw.paidAt) : undefined,
  };
}
