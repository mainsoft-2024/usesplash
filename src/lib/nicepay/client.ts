import { randomUUID } from "node:crypto";
import { getBasicAuthHeader } from "./auth";
import { getNicepayConfig } from "./config";
import { NicepayApiError } from "./errors";

type Method = "POST" | "GET";
type Init = { method: Method; body?: object; timeoutMs?: number; fetchImpl?: typeof fetch };

const SECRET_KEY_PATTERN = /(card|cvv|password|pwd|encData|authToken|secretKey)/i;
const mask = (v: unknown): unknown => (Array.isArray(v) ? v.map(mask) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, SECRET_KEY_PATTERN.test(k) ? "***" : mask(x)])) : v);
const log = (msg: string, data: Record<string, unknown>) => {
  void msg;
  void data;
};

/** Performs NICEPAY API request with timeout and typed JSON response. */
export async function nicepayFetch<T>(path: string, init: Init): Promise<T> {
  const fetchImpl = init.fetchImpl ?? globalThis.fetch;
  const cfg = getNicepayConfig();
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? 15000;
  const rid = randomUUID();
  const start = Date.now();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${cfg.apiBase}${path}`, {
      method: init.method,
      headers: { Authorization: getBasicAuthHeader(cfg.clientId, cfg.secretKey), "Content-Type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as unknown) : {};
    if (!response.ok) throw new NicepayApiError(`NICEPAY HTTP ${response.status}`, (parsed as { resultCode?: string }).resultCode, (parsed as { resultMsg?: string }).resultMsg);
    return parsed as T;
  } finally {
    clearTimeout(timer);
    log("nicepay.request", { requestId: rid, path, durationMs: Date.now() - start, method: init.method, body: mask(init.body) });
  }
}
