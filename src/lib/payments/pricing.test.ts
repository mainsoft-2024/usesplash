import { describe, expect, it } from "vitest";
import { getPricing } from "./pricing";

describe("pricing", () => {
  it("matches configured KRW plan prices", () => {
    expect(getPricing()).toMatchInlineSnapshot(`
      {
        "currency": "KRW",
        "monthly": 19900,
        "yearly": 199000,
      }
    `);
  });
});
