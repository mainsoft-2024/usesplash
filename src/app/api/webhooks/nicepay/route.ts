import { Prisma } from "@/generated/prisma/client";
import { recordPaymentResult } from "@/lib/billing/record-payment";
import { env } from "@/lib/env";
import { signWebhook, timingSafeEqual } from "@/lib/nicepay/signature";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 10;

type WebhookPayload = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function redactPayload(payload: WebhookPayload): WebhookPayload {
  const clone: WebhookPayload = { ...payload };
  if ("signData" in clone) clone.signData = "[REDACTED]";
  if ("cardNum" in clone) clone.cardNum = "[REDACTED]";
  if ("cardNo" in clone) clone.cardNo = "[REDACTED]";
  return clone;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

async function persistInvalidSignature(args: { eventId: string; type: string; payload: WebhookPayload }): Promise<void> {
  await prisma.webhookEvent.create({
    data: {
      eventId: args.eventId,
      type: args.type,
      payload: args.payload as unknown as Prisma.InputJsonValue,
      signatureValid: false,
      processingError: "invalid_signature",
      receivedAt: new Date(),
    },
  });
}

async function dispatchByType(type: string, payload: WebhookPayload): Promise<void> {
  const normalizedType = type.toLowerCase();
  const orderId = asString(payload.orderId);
  const subscriptionId = asString(payload.subscriptionId);
  const tid = asString(payload.tid) ?? asString(payload.providerPaymentId) ?? asString(payload.providerTransactionId) ?? "";
  const amount = asNumber(payload.amount) ?? 0;

  if (normalizedType === "paid" || normalizedType === "vbankdeposited") {
    if (!orderId || !subscriptionId || !tid) return;
    await recordPaymentResult({
      subscriptionId,
      paymentResult: {
        orderId,
        providerPaymentId: tid,
        providerTransactionId: tid,
        paid: true,
        amount,
        currency: "KRW",
        paymentMethod: "vbank",
      },
    });
    return;
  }

  if (normalizedType === "expired" || normalizedType === "vbankexpired") {
    if (!orderId) return;
    await prisma.payment.update({
      where: { orderId },
      data: { status: "failed", errorCode: "vbank_expired", errorMessage: "vbank_expired" },
    });
    return;
  }

  if (normalizedType === "cancelled" || normalizedType === "canceled") {
    if (!orderId || !subscriptionId || !tid) return;
    const cancelAmount = asNumber(payload.cancelAmount) ?? 0;
    await recordPaymentResult({
      subscriptionId,
      paymentResult: {
        orderId,
        providerPaymentId: tid,
        providerTransactionId: tid,
        paid: true,
        amount: cancelAmount > 0 ? -cancelAmount : 0,
        currency: "KRW",
        paymentMethod: "other",
        raw: { refunded: true },
      },
    });
    return;
  }

  if (normalizedType === "recurring_paid" || normalizedType === "billingpaid") {
    if (!orderId || !subscriptionId || !tid) return;
    await recordPaymentResult({
      subscriptionId,
      paymentResult: {
        orderId,
        providerPaymentId: tid,
        providerTransactionId: tid,
        paid: true,
        amount,
        currency: "KRW",
        paymentMethod: "card",
        paymentType: "recurring",
      },
    });
    return;
  }

  if (normalizedType === "recurring_failed" || normalizedType === "billingfailed") {
    if (!orderId || !subscriptionId || !tid) return;
    await recordPaymentResult({
      subscriptionId,
      paymentResult: {
        orderId,
        providerPaymentId: tid,
        providerTransactionId: tid,
        paid: false,
        amount,
        currency: "KRW",
        paymentMethod: "card",
        paymentType: "recurring",
      },
    });
    return;
  }

  await prisma.auditLog.create({
    data: {
      action: "nicepay.webhook.unknown_type",
      payload: { type, payload: redactPayload(payload) } as unknown as Prisma.InputJsonValue,
    },
  });
}

// NICE 가맹점 콘솔에서 webhook URL 등록 시 GET으로 200 헬스체크를 수행함.
// 실제 webhook 이벤트는 POST로 도착.
export async function GET(): Promise<Response> {
  return Response.json({ ok: true });
}

export async function POST(request: Request): Promise<Response> {
  const bodyText = await request.text();
  let payload: WebhookPayload;

  try {
    payload = JSON.parse(bodyText) as WebhookPayload;
  } catch {
    return Response.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const type = asString(payload.type) ?? "unknown";
  const tid = asString(payload.tid) ?? "";
  const ediDate = asString(payload.ediDate) ?? "";
  const eventId = asString(payload.eventId) ?? `${tid}:${ediDate}`;
  const signData = asString(payload.signData) ?? "";
  const authToken = asString(payload.authToken) ?? "";
  const clientId = asString(payload.clientId) ?? env.NICEPAY_CLIENT_ID;
  const orderId = asString(payload.orderId) ?? "";
  const amount = asNumber(payload.amount) ?? 0;

  const expectedSignature = signWebhook({ authToken, clientId, orderId, amount, secretKey: env.NICEPAY_SECRET_KEY });
  if (!timingSafeEqual(expectedSignature, signData)) {
    await persistInvalidSignature({ eventId, type, payload });
    return Response.json({ ok: false, reason: "invalid_signature" }, { status: 400 });
  }

  try {
    await prisma.webhookEvent.create({
      data: {
        eventId,
        type,
        payload: payload as unknown as Prisma.InputJsonValue,
        signatureValid: true,
        receivedAt: new Date(),
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return Response.json({ ok: true, replay: true }, { status: 200 });
    }
    throw error;
  }

  try {
    await dispatchByType(type, payload);
    await prisma.webhookEvent.update({
      where: { eventId },
      data: { processedAt: new Date() },
    });
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "webhook_dispatch_failed";
    await prisma.webhookEvent.update({
      where: { eventId },
      data: { processingError: message },
    });
    console.warn("nicepay webhook dispatch failed", { eventId, type, payload: redactPayload(payload), message });
    return Response.json({ ok: true }, { status: 200 });
  }
}
