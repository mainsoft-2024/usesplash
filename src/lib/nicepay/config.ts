import { env } from "@/lib/env";
import type { NicepayConfig } from "./types";

/** Returns validated NICEPAY runtime configuration. */
export function getNicepayConfig(): NicepayConfig {
  if (env.NICEPAY_MODE === "live" && process.env.VERCEL_ENV !== "production") {
    throw new Error("NICEPAY_MODE=live is only allowed when VERCEL_ENV=production");
  }

  return { mode: env.NICEPAY_MODE, apiBase: env.NICEPAY_API_BASE, clientId: env.NICEPAY_CLIENT_ID, secretKey: env.NICEPAY_SECRET_KEY, jsSdkUrl: env.NICEPAY_JS_SDK_URL };
}
