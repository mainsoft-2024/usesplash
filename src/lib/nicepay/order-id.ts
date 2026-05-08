import { randomBytes } from "node:crypto";

export const NICEPAY_ORDER_ID_REGEX = /^splash_[A-Za-z0-9]{8}_\d{10}_[A-Za-z0-9]{4}$/;
const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Generates splash_{userIdShort8}_{epochSeconds}_{rand4}. */
export function generateOrderId(userId: string): string {
  const userIdShort8 = userId.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).padEnd(8, "x");
  const epochSeconds = Math.floor(Date.now() / 1000).toString();
  const rb = randomBytes(4);
  const rand4 = Array.from(rb, (b) => ALNUM[b % ALNUM.length]).join("");
  const id = `splash_${userIdShort8}_${epochSeconds}_${rand4}`;
  if (!NICEPAY_ORDER_ID_REGEX.test(id)) throw new Error("Generated invalid NICEPAY orderId");
  return id;
}
