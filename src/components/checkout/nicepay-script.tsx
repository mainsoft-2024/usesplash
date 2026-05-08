"use client";

import Script from "next/script";

/**
 * Loads the NICE Payments JS SDK. Must be mounted on any page that calls
 * `AUTHNICE.requestPay`. The SDK URL is injected from a server component
 * so we never expose secret env vars to the client bundle.
 */
export function NicepayScript({ jsSdkUrl }: { jsSdkUrl: string }) {
  return <Script src={jsSdkUrl} strategy="afterInteractive" />;
}
