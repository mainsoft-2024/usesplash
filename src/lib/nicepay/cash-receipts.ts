import { nicepayFetch } from "./client";

export const issue = (body: Record<string, unknown>) => nicepayFetch<Record<string, unknown>>("/v1/receipt", { method: "POST", body });
export const cancel = (tid: string, body: Record<string, unknown>) => nicepayFetch<Record<string, unknown>>(`/v1/receipt/${tid}/cancel`, { method: "POST", body });
export const getStatus = (tid: string) => nicepayFetch<Record<string, unknown>>(`/v1/receipt/${tid}`, { method: "GET" });
