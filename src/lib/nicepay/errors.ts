export class NicepayError extends Error { constructor(message: string, public resultCode?: string, public resultMsg?: string) { super(message); this.name = "NicepayError"; } }
export class NicepaySignatureError extends NicepayError { constructor(msg = "Signature verification failed", code?: string) { super(msg, code, msg); this.name = "NicepaySignatureError"; } }
export class NicepayAmountMismatchError extends NicepayError { constructor(msg = "Amount mismatch", code?: string) { super(msg, code, msg); this.name = "NicepayAmountMismatchError"; } }
export class NicepayBillingKeyCardOnlyError extends NicepayError { constructor(msg = "Pro 정기결제는 신용카드만 지원해요", code?: string) { super(msg, code, msg); this.name = "NicepayBillingKeyCardOnlyError"; } }
export class NicepayApiError extends NicepayError { constructor(msg: string, code?: string, resultMsg?: string) { super(msg, code, resultMsg); this.name = "NicepayApiError"; } }

export function mapResultCodeToError(resultCode: string, resultMsg: string): NicepayError {
  if (resultCode === "0000") return new NicepayError("Success", resultCode, resultMsg);
  if (resultCode.startsWith("F05") || resultCode.includes("SIG")) return new NicepaySignatureError(resultMsg, resultCode);
  return new NicepayApiError(resultMsg || "NICEPAY API error", resultCode, resultMsg);
}
