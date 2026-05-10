import { nicepayFetch } from "./client";
import { getNicepayConfig } from "./config";
import { signApprove, signCancel } from "./signature";
import type { NicepayApprovalResponse, NicepayCancelResponse } from "./types";

const kstIso = () => new Date().toISOString().replace("Z", "+09:00");

/**
 * POST /v1/payments/{tid} — Server 승인 모델.
 * Authorization: Basic <clientId:secretKey> + body { amount, ediDate, signData, returnCharSet }.
 * signData = hex(sha256(tid + amount + ediDate + secretKey)).
 * 가맹점의 sign 검증 설정이 활성이면 signData 누락 시 U312로 거절됨.
 */
export function approve(input: { tid: string; amount: number; ediDate?: string }) {
  const cfg = getNicepayConfig();
  const ediDate = input.ediDate ?? kstIso();
  const signData = signApprove({ tid: input.tid, amount: input.amount, ediDate, secretKey: cfg.secretKey });
  return nicepayFetch<NicepayApprovalResponse>(`/v1/payments/${input.tid}`, {
    method: "POST",
    body: { amount: input.amount, ediDate, signData, returnCharSet: "utf-8" },
  });
}
/**
 * POST /v1/payments/{tid}/cancel — 전액 또는 부분 취소.
 * orderId는 필수 (누락 시 U100). 전액취소엔 원거래 orderId, 부분취소엔 새로 채번된 고유 orderId.
 */
export function cancel(input: {
  tid: string;
  opts: {
    orderId: string;
    reason: string;
    cancelAmt?: number;
    taxFreeAmt?: number;
    refundAccount?: string;
    refundBankCode?: string;
    refundHolder?: string;
    isNetCancel?: "1";
    mallReserved?: string;
  };
}) {
  const cfg = getNicepayConfig();
  const ediDate = kstIso();
  const signData = signCancel({ tid: input.tid, ediDate, secretKey: cfg.secretKey });
  return nicepayFetch<NicepayCancelResponse>(`/v1/payments/${input.tid}/cancel`, {
    method: "POST",
    body: { ...input.opts, ediDate, signData, returnCharSet: "utf-8" },
  });
}
export function findByOrderId(orderId: string) { return nicepayFetch<NicepayApprovalResponse>(`/v1/payments/find/${orderId}`, { method: "GET" }); }
export function findByTid(tid: string) { return nicepayFetch<NicepayApprovalResponse>(`/v1/payments/${tid}`, { method: "GET" }); }
