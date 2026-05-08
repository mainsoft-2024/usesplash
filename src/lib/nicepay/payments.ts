import { getNicepayConfig } from "./config";
import { nicepayFetch } from "./client";
import { signApprove, signCancel } from "./signature";
import type { NicepayApprovalResponse, NicepayCancelResponse } from "./types";

const kstIso = () => new Date().toISOString().replace("Z", "+09:00");

/** POST /v1/payments/{tid} approval. */
export function approve(input: { tid: string; amount: number; ediDate?: string; signData?: string }) {
  const cfg = getNicepayConfig(); const ediDate = input.ediDate ?? kstIso();
  const signData = input.signData ?? signApprove({ authToken: input.tid, clientId: cfg.clientId, amount: input.amount, ediDate, secretKey: cfg.secretKey });
  return nicepayFetch<NicepayApprovalResponse>(`/v1/payments/${input.tid}`, { method: "POST", body: { amount: input.amount, ediDate, signData, returnCharSet: "utf-8" } });
}
/** POST /v1/payments/{tid}/cancel. */
export function cancel(input: { tid: string; opts: Record<string, unknown> }) {
  const cfg = getNicepayConfig(); const ediDate = kstIso();
  const signData = signCancel({ tid: input.tid, ediDate, secretKey: cfg.secretKey });
  return nicepayFetch<NicepayCancelResponse>(`/v1/payments/${input.tid}/cancel`, { method: "POST", body: { ...input.opts, ediDate, signData, returnCharSet: "utf-8" } });
}
export function findByOrderId(orderId: string) { return nicepayFetch<NicepayApprovalResponse>(`/v1/payments/find/${orderId}`, { method: "GET" }); }
export function findByTid(tid: string) { return nicepayFetch<NicepayApprovalResponse>(`/v1/payments/${tid}`, { method: "GET" }); }
