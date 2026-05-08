import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signApprove, signBilling, signBillingApprove, signCancel, signReturnUrl, timingSafeEqual } from "../signature";

describe("signature", () => {
  it("uses correct concatenation order", () => {
    // approve API 요청 signData: hex(sha256(tid + amount + ediDate + secretKey))
    expect(signApprove({ tid: "t", amount: "100", ediDate: "c", secretKey: "d" })).toBe(createHash("sha256").update("t100cd").digest("hex"));
    // returnUrl 검증: hex(sha256(authToken + clientId + amount + secretKey)) — ediDate 없음
    expect(signReturnUrl({ authToken: "a", clientId: "b", amount: "100", secretKey: "d" })).toBe(createHash("sha256").update("ab100d").digest("hex"));
    expect(signBilling({ orderId: "o", ediDate: "e", secretKey: "s" })).toBe(createHash("sha256").update("oes").digest("hex"));
    expect(signBillingApprove({ orderId: "o", bid: "b", ediDate: "e", secretKey: "s" })).toBe(createHash("sha256").update("obes").digest("hex"));
    expect(signCancel({ tid: "t", ediDate: "e", secretKey: "s" })).toBe(createHash("sha256").update("tes").digest("hex"));
  });
  it("timingSafeEqual works", () => {
    const a = "aa".repeat(32);
    expect(timingSafeEqual(a, a)).toBe(true);
    expect(timingSafeEqual(a, "aa")).toBe(false);
    expect(timingSafeEqual(a, "bb".repeat(32))).toBe(false);
  });
});
