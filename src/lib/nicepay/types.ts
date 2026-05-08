export type Mode = "test" | "live";

export type NicepayConfig = { mode: Mode; apiBase: string; clientId: string; secretKey: string; jsSdkUrl: string };

export type ProviderPaymentResult = {
  orderId: string;
  providerPaymentId: string;
  providerTransactionId?: string;
  status: "paid" | "failed" | "refunded" | "pending_vbank";
  amount: number;
  currency: "KRW";
  errorCode?: string;
  errorMessage?: string;
  receiptUrl?: string;
  paymentMethod: "card" | "vbank" | "bank" | "kakaopay" | "naverpay" | "easypay" | "cellphone";
  paidAt?: Date;
};

export type NicepayBaseResponse = { resultCode: string; resultMsg: string };
export type NicepayApprovalResponse = NicepayBaseResponse & { tid: string; orderId: string; amount: number; currency?: string; payMethod?: string; paidAt?: string; receiptUrl?: string; status?: string };
export type NicepayCancelResponse = NicepayBaseResponse & { tid: string; orderId?: string; status?: string; cancelAmt?: number };
export type NicepayBillingIssueResponse = NicepayBaseResponse & { tid: string; bid: string; orderId: string; cardNo?: string; cardName?: string };
export type NicepayBillingApproveResponse = NicepayBaseResponse & { tid: string; orderId: string; bid?: string; amount: number; status?: string; paidAt?: string; payMethod?: string; receiptUrl?: string };
