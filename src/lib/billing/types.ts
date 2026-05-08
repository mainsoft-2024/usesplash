export type ProviderPaymentResult = {
  orderId: string;
  providerPaymentId: string;
  providerTransactionId?: string;
  paid: boolean;
  amount: number;
  currency: "KRW";
  paidAt?: Date;
  paymentMethod: "card" | "vbank" | "cellphone" | "easypay" | "other";
  paymentType?: "one_shot" | "recurring";
  cardName?: string;
  cardBrand?: string;
  last4?: string;
  cardQuota?: number;
  failureReason?: { code: string; message: string };
  raw?: unknown;
};
