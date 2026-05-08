import { describe, expect, it } from "vitest";
import { toProviderPaymentResult } from "../adapter";

describe("adapter", () => {
  it("maps approval response", () => {
    const res = toProviderPaymentResult({ resultCode: "0000", resultMsg: "ok", tid: "T1", orderId: "O1", amount: 19900, currency: "KRW", payMethod: "CARD", paidAt: "2021-11-05T17:14:35.000+0900", receiptUrl: "https://example.com" });
    expect(res.paidAt).toBeInstanceOf(Date);
    expect(res).toMatchObject({ status: "paid", amount: 19900, currency: "KRW", orderId: "O1", providerPaymentId: "T1", providerTransactionId: "T1" });
  });
});
