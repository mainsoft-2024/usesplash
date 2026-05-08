import { nicepayFetch } from "./client";
import { getNicepayConfig } from "./config";
import { signBilling, signBillingApprove } from "./signature";
import type { NicepayBillingApproveResponse, NicepayBillingIssueResponse } from "./types";

const kstIso = () => new Date().toISOString().replace("Z", "+09:00");

/** POST /v1/subscribe/regist. */
export function issue(input: { orderId: string; encData: string; encMode?: "A2" }) {
  const cfg = getNicepayConfig(); const ediDate = kstIso();
  return nicepayFetch<NicepayBillingIssueResponse>("/v1/subscribe/regist", { method: "POST", body: { orderId: input.orderId, encData: input.encData, encMode: input.encMode ?? "A2", ediDate, signData: signBilling({ orderId: input.orderId, ediDate, secretKey: cfg.secretKey }), returnCharSet: "utf-8" } });
}
/** POST /v1/subscribe/{bid}/payments. */
export function approve(input: { bid: string; orderId: string; amount: number; goodsName: string; cardQuota?: string; useShopInterest?: boolean; buyerName?: string; buyerTel?: string; buyerEmail?: string }) {
  const cfg = getNicepayConfig(); const ediDate = kstIso();
  return nicepayFetch<NicepayBillingApproveResponse>(`/v1/subscribe/${input.bid}/payments`, { method: "POST", body: { ...input, cardQuota: input.cardQuota ?? "0", useShopInterest: input.useShopInterest ?? false, ediDate, signData: signBillingApprove({ orderId: input.orderId, bid: input.bid, ediDate, secretKey: cfg.secretKey }), returnCharSet: "utf-8" } });
}
/** POST /v1/subscribe/{bid}/expire. */
export function expire(input: { bid: string; orderId: string }) {
  const cfg = getNicepayConfig(); const ediDate = kstIso();
  return nicepayFetch<NicepayBillingIssueResponse>(`/v1/subscribe/${input.bid}/expire`, { method: "POST", body: { orderId: input.orderId, ediDate, signData: signBillingApprove({ orderId: input.orderId, bid: input.bid, ediDate, secretKey: cfg.secretKey }), returnCharSet: "utf-8" } });
}
