/** Returns Basic authorization header for NICEPAY APIs. */
export function getBasicAuthHeader(clientId: string, secretKey: string): string {
  return `Basic ${Buffer.from(`${clientId}:${secretKey}`).toString("base64")}`;
}
