import { createCipheriv } from "node:crypto";

/** Encrypts billing plain text with AES-256-CBC (A2) and returns hex. */
export function encryptBillingKeyData(plain: string, secretKey: string): string {
  if (Buffer.byteLength(secretKey, "utf8") !== 32) throw new Error("NICEPAY secret key must be 32 bytes");
  const key = Buffer.from(secretKey, "utf8");
  const iv = key.subarray(0, 16);
  const plainBuffer = Buffer.from(plain, "utf8");
  try {
    const cipher = createCipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([cipher.update(plainBuffer), cipher.final()]).toString("hex");
  } finally {
    plainBuffer.fill(0);
  }
}
