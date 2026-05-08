import { nicepayFetch } from "./client";
import type { NicepayApprovalResponse, NicepayCancelResponse } from "./types";

const kstIso = () => new Date().toISOString().replace("Z", "+09:00");

/**
 * POST /v1/payments/{tid} — Server 승인 모델.
 * NICE 공식 문서 기준: 본문은 { amount } 하나면 충분. Authorization: Basic <clientId:secretKey>.
 * authToken/signData는 returnUrl 검증용이며 승인 API 본문에는 들어가지 않음.
 */
export function approve(input: { tid: string; amount: number; ediDate?: string }) {
  const ediDate = input.ediDate ?? kstIso();
  return nicepayFetch<NicepayApprovalResponse>(`/v1/payments/${input.tid}`, {
    method: "POST",
    body: { amount: input.amount, ediDate, returnCharSet: "utf-8" },
  });
}
/** POST /v1/payments/{tid}/cancel. */
export function cancel(input: { tid: string; opts: Record<string, unknown> }) {
  const ediDate = kstIso();
  return nicepayFetch<NicepayCancelResponse>(`/v1/payments/${input.tid}/cancel`, {
    method: "POST",
    body: { ...input.opts, ediDate, returnCharSet: "utf-8" },
  });
}
export function findByOrderId(orderId: string) { return nicepayFetch<NicepayApprovalResponse>(`/v1/payments/find/${orderId}`, { method: "GET" }); }
export function findByTid(tid: string) { return nicepayFetch<NicepayApprovalResponse>(`/v1/payments/${tid}`, { method: "GET" }); }
