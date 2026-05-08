import { describe, expect, it } from "vitest";
import { generateOrderId, NICEPAY_ORDER_ID_REGEX } from "../order-id";

describe("order-id", () => {
  it("matches regex for many ids", () => {
    for (let i = 0; i < 50; i += 1) expect(NICEPAY_ORDER_ID_REGEX.test(generateOrderId("user_123"))).toBe(true);
  });
  it("pads when no ascii alnum", () => {
    expect(generateOrderId("가나다라마바사")).toContain("splash_xxxxxxxx_");
  });
});
