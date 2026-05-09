import { Prisma } from "@/generated/prisma/client";
import * as nicepay from "@/lib/nicepay";
import { recordPaymentResult } from "@/lib/billing/record-payment";
import type { ProviderPaymentResult } from "@/lib/billing/types";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const REDIRECT_BASE = "/account/payments";

function redirectTo(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } });
}

async function writeAudit(action: string, payload: Record<string, unknown>, targetUserId?: string): Promise<void> {
  await prisma.auditLog.create({ data: { action, targetUserId, payload: payload as unknown as Prisma.InputJsonValue } });
}

async function markFailed(orderId: string, code: string, message?: string): Promise<void> {
  await prisma.payment.updateMany({
    where: { orderId },
    data: { status: "failed", errorCode: code, errorMessage: message ?? null },
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const authResultCode = String(formData.get("authResultCode") ?? "");
    const authResultMsg = String(formData.get("authResultMsg") ?? "");
    const authToken = String(formData.get("authToken") ?? "");
    const tid = String(formData.get("tid") ?? "");
    const orderId = String(formData.get("orderId") ?? "");
    const amount = String(formData.get("amount") ?? "");
    const signature = String(formData.get("signature") ?? "");
    const ediDate = String(formData.get("ediDate") ?? "");
    const mallReserved = formData.get("mallReserved")?.toString();
    const mid = formData.get("mid")?.toString();
    const method = formData.get("method")?.toString();

    if (authResultCode !== "0000") {
      await markFailed(orderId, `auth_${authResultCode}`, authResultMsg);
      await writeAudit(`payment_return_auth_${authResultCode}`, { orderId, tid, amount, authResultMsg });
      return redirectTo(`${REDIRECT_BASE}?status=failed&reason=auth_${authResultCode}`);
    }

    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (!payment || payment.status !== "pending") {
      await writeAudit("payment_return_unknown_order", { orderId, tid, amount });
      return redirectTo(`${REDIRECT_BASE}?status=failed&reason=unknown_order`);
    }

    const expectedSignature = nicepay.signReturnUrl({
      authToken,
      clientId: env.NICEPAY_CLIENT_ID,
      amount,
      secretKey: env.NICEPAY_SECRET_KEY,
    });

    if (!nicepay.timingSafeEqual(expectedSignature, signature)) {
      await markFailed(orderId, "signature_mismatch", "signature_mismatch");
      await writeAudit("payment_return_signature_mismatch", { orderId, tid, amount, ediDate, mallReserved, mid }, payment.userId);
      return redirectTo(`${REDIRECT_BASE}?status=failed&reason=signature_mismatch`);
    }

    if (Number(amount) !== payment.amount) {
      await markFailed(orderId, "amount_mismatch", "amount_mismatch");
      await writeAudit("payment_return_amount_mismatch", { orderId, tid, amount, dbAmount: payment.amount }, payment.userId);
      return redirectTo(`${REDIRECT_BASE}?status=failed&reason=amount_mismatch`);
    }

    let approveResponse: Awaited<ReturnType<typeof nicepay.payments.approve>>;
    try {
      approveResponse = await nicepay.payments.approve({ tid, amount: Number(amount), ediDate });
    } catch (error) {
      const maybeError = error as { resultCode?: string; resultMsg?: string; message?: string };
      const code = maybeError.resultCode ?? "approval_error";
      await markFailed(orderId, code, maybeError.resultMsg ?? maybeError.message);
      await writeAudit(`payment_return_approval_${code}`, { orderId, tid, amount, message: maybeError.message ?? null }, payment.userId);
      const detail = encodeURIComponent(maybeError.resultMsg ?? maybeError.message ?? "");
      return redirectTo(`${REDIRECT_BASE}?status=failed&reason=approval_${code}&detail=${detail}`);
    }

    // NICE는 HTTP 200으로 응답하면서도 resultCode ≠ '0000' 으로 승인 실패를 돌려줄 수 있음.
    // 이 경우 recordPaymentResult 에 paid:false로 보내면 state machine이 free→charge_failed를 불법으로 간주함.
    // 그래서 안전장치: 0000이 아닌 경우 markFailed만 하고 종료.
    if (approveResponse.resultCode !== "0000") {
      const code = approveResponse.resultCode ?? "approval_failed";
      await markFailed(orderId, code, approveResponse.resultMsg ?? null);
      await writeAudit(`payment_return_approval_${code}`, { orderId, tid, amount, resultMsg: approveResponse.resultMsg ?? null }, payment.userId);
      const detail = encodeURIComponent(approveResponse.resultMsg ?? "");
      return redirectTo(`${REDIRECT_BASE}?status=failed&reason=approval_${code}&detail=${detail}`);
    }

    const adapted = nicepay.toProviderPaymentResult(approveResponse);
    const billingResult: ProviderPaymentResult = {
      orderId: adapted.orderId,
      providerPaymentId: adapted.providerPaymentId,
      providerTransactionId: adapted.providerTransactionId,
      paid: adapted.status === "paid",
      amount: adapted.amount,
      currency: "KRW",
      paidAt: adapted.paidAt,
      receiptUrl: adapted.receiptUrl,
      paymentMethod: method === "card" ? "card" : "other",
      paymentType: "one_shot",
      failureReason:
        adapted.status === "paid"
          ? undefined
          : {
              code: adapted.errorCode ?? "approval_failed",
              message: adapted.errorMessage ?? "approval_failed",
            },
      raw: approveResponse,
    };

    await recordPaymentResult({ subscriptionId: payment.subscriptionId, paymentResult: billingResult });

    if (method === "card") {
      try {
        const activeBillingKey = await prisma.billingKey.findFirst({ where: { userId: payment.userId, isActive: true } });
        const alreadyPaidPro = await prisma.payment.count({
          where: { userId: payment.userId, status: "completed", amount: payment.amount, id: { not: payment.id } },
        });
        if (!activeBillingKey && alreadyPaidPro === 0) {
          const bid = formData.get("bid")?.toString();
          if (bid) {
            await prisma.billingKey.create({
              data: {
                userId: payment.userId,
                subscriptionId: payment.subscriptionId,
                bid,
                type: "domestic_card",
                cardName: formData.get("cardName")?.toString() ?? null,
                cardBrand: formData.get("cardBrand")?.toString() ?? null,
                last4: formData.get("last4")?.toString() ?? null,
                isActive: true,
              },
            });
          }
        }
      } catch {
        await writeAudit("payment_return_billing_key_issue_failed", { orderId, tid, amount }, payment.userId);
      }
    }

    return redirectTo(`${REDIRECT_BASE}?status=success&orderId=${encodeURIComponent(orderId)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    // eslint-disable-next-line no-console
    console.error("[nicepay-return] internal error", { message, stack });
    try {
      await writeAudit("payment_return_internal_error", { message, stack });
    } catch {
      // ignore audit write failures during error path
    }
    return redirectTo(`${REDIRECT_BASE}?status=failed&reason=internal_error&detail=${encodeURIComponent(message)}`);
  }
}
