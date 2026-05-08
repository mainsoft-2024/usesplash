import { createDecipheriv } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encryptBillingKeyData } from "../crypto";

describe("crypto", () => {
  it("round-trips aes-256-cbc", () => {
    const secretKey = "12345678901234567890123456789012";
    const plain = "cardNo=1234&expYear=30&expMonth=12&idNo=900101&cardPw=12";
    const enc = encryptBillingKeyData(plain, secretKey);
    const key = Buffer.from(secretKey, "utf8");
    const decipher = createDecipheriv("aes-256-cbc", key, key.subarray(0, 16));
    const out = Buffer.concat([decipher.update(Buffer.from(enc, "hex")), decipher.final()]).toString("utf8");
    expect(out).toBe(plain);
  });
  it("rejects non-32-byte key", () => expect(() => encryptBillingKeyData("x", "short")).toThrow());
});
