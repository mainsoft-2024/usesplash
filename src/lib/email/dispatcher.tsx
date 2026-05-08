import type { ReactElement } from "react";
import { sendEmail } from "./client";
import { AutoDowngradeEmail, autoDowngradeSubject } from "./templates/AutoDowngradeEmail";
import { CancellationEmail, cancellationSubject } from "./templates/CancellationEmail";
import { PaymentFailureEmail, paymentFailureSubject } from "./templates/PaymentFailureEmail";
import { PaymentSuccessEmail, paymentSuccessSubject } from "./templates/PaymentSuccessEmail";
import { RefundConfirmationEmail, refundConfirmationSubject } from "./templates/RefundConfirmationEmail";

type DispatchResult = { ok: true } | { ok: false; reason: string };

async function safeSend(to: string, subject: string, react: ReactElement): Promise<DispatchResult> {
  try {
    const result = await sendEmail({ to, subject, react });
    if ("error" in result) return { ok: false, reason: result.error };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "unknown_error" };
  }
}

export async function dispatchPaymentSuccessEmail(input: {
  to: string;
  name?: string;
  plan: string;
  amount: number;
  orderId: string;
  paidAt: Date;
  providerPaymentId: string;
}): Promise<DispatchResult> {
  return safeSend(input.to, paymentSuccessSubject, <PaymentSuccessEmail {...input} />);
}

export async function dispatchPaymentFailureEmail(input: {
  to: string;
  name?: string;
  reason: string;
  retryDate?: Date;
}): Promise<DispatchResult> {
  return safeSend(input.to, paymentFailureSubject, <PaymentFailureEmail {...input} />);
}

export async function dispatchCancellationEmail(input: {
  to: string;
  name?: string;
  accessUntil: Date;
}): Promise<DispatchResult> {
  return safeSend(input.to, cancellationSubject, <CancellationEmail {...input} />);
}

export async function dispatchAutoDowngradeEmail(input: {
  to: string;
  name?: string;
}): Promise<DispatchResult> {
  return safeSend(input.to, autoDowngradeSubject, <AutoDowngradeEmail {...input} />);
}

export async function dispatchRefundConfirmationEmail(input: {
  to: string;
  name?: string;
  amount: number;
  orderId: string;
  refundedAt: Date;
}): Promise<DispatchResult> {
  return safeSend(input.to, refundConfirmationSubject, <RefundConfirmationEmail {...input} />);
}
