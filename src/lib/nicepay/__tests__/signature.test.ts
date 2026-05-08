import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signApprove, signBilling, signBillingApprove, signCancel, timingSafeEqual } from "../signature";

describe("signature", () => {
  it("uses correct concatenation order", () => {
    expect(signApprove({ authToken: "a", clientId: "b", amount: "100", ediDate: "c", secretKey: "d" })).toBe(createHash("sha256").update("ab100cd").digest("hex"));
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
