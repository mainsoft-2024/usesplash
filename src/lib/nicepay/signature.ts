import { createHash, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";

const sha256Hex = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");

/**
 * Return URL signature verification (NICE → 가맹점).
 * NICE가 returnUrl로 POST할 때 함께 보내는 `signature` 검증용.
 * 공식 공식: hex(sha256(authToken + clientId + amount + SecretKey))  — ediDate 없음.
 */
export const signReturnUrl = ({ authToken, clientId, amount, secretKey }: { authToken: string; clientId: string; amount: string | number; secretKey: string }) => sha256Hex(`${authToken}${clientId}${amount}${secretKey}`);

/**
 * Approve API 본문 signData (가맹점 → NICE).
 * POST /v1/payments/{tid} 요청의 body 안에 넘기는 값.
 * 공식 공식: hex(sha256(tid + amount + ediDate + SecretKey))
 */
export const signApprove = ({ tid, amount, ediDate, secretKey }: { tid: string; amount: string | number; ediDate: string; secretKey: string }) => sha256Hex(`${tid}${amount}${ediDate}${secretKey}`);
/** sha256(orderId + ediDate + secretKey). */
export const signBilling = ({ orderId, ediDate, secretKey }: { orderId: string; ediDate: string; secretKey: string }) => sha256Hex(`${orderId}${ediDate}${secretKey}`);
/** sha256(orderId + bid + ediDate + secretKey). */
export const signBillingApprove = ({ orderId, bid, ediDate, secretKey }: { orderId: string; bid: string; ediDate: string; secretKey: string }) => sha256Hex(`${orderId}${bid}${ediDate}${secretKey}`);
/** sha256(tid + ediDate + secretKey). */
export const signCancel = ({ tid, ediDate, secretKey }: { tid: string; ediDate: string; secretKey: string }) => sha256Hex(`${tid}${ediDate}${secretKey}`);
/** NICE return/webhook signature default rule. */
export const signWebhook = ({ authToken, clientId, orderId, amount, secretKey }: { authToken: string; clientId: string; orderId: string; amount: string | number; secretKey: string }) => sha256Hex(`${authToken}${clientId}${orderId}${amount}${secretKey}`);

/** Timing-safe hex string compare; false on length mismatch. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aa = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (aa.length !== bb.length) return false;
  return cryptoTimingSafeEqual(aa, bb);
}
