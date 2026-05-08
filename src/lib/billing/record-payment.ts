import type { Payment, Subscription } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { transition, type EmailKind } from "./state-machine";
import type { ProviderPaymentResult } from "./types";

export type RecordPaymentParams = {
  subscriptionId: string;
  paymentResult: ProviderPaymentResult;
};

export type PaymentMailer = (args: {
  subscriptionId: string;
  email: EmailKind;
  paymentId: string;
}) => Promise<void>;

type MinimalSubscription = Subscription;

type TxClient = {
  payment: { upsert: (args: unknown) => Promise<Payment> };
  invoice: { upsert: (args: unknown) => Promise<unknown> };
  subscription: {
    findUnique: (args: unknown) => Promise<MinimalSubscription | null>;
    update: (args: unknown) => Promise<Subscription>;
  };
};

type PrismaLike = { $transaction: <T>(fn: (tx: TxClient) => Promise<T>) => Promise<T> };

const noopMailer: PaymentMailer = async () => undefined;

/**
 * Default real mailer: looks up user + payment, dispatches the matching
 * email template. Fully best-effort — never throws (dispatcher is internally
 * try/caught), so payment flows are not blocked by email failures.
 */
const defaultMailer: PaymentMailer = async ({ subscriptionId, email, paymentId }) => {
  const [{ dispatchPaymentSuccessEmail, dispatchPaymentFailureEmail, dispatchCancellationEmail, dispatchAutoDowngradeEmail }, sub, pay] = await Promise.all([
    import("@/lib/email"),
    prisma.subscription.findUnique({ where: { id: subscriptionId }, include: { user: { select: { email: true, name: true } } } }),
    prisma.payment.findUnique({ where: { id: paymentId } }),
  ]);
  if (!sub?.user?.email) return;
  const to = sub.user.email;
  const name = sub.user.name ?? undefined;
  const orderId = pay?.orderId ?? "";
  const amount = pay?.amount ?? 0;
  switch (email) {
    case "payment_success":
      await dispatchPaymentSuccessEmail({ to, name, plan: sub.tier === "pro" ? "Splash Pro" : sub.tier, amount, orderId, paidAt: pay?.paidAt ?? new Date(), providerPaymentId: pay?.providerPaymentId ?? "" });
      return;
    case "payment_failure":
      await dispatchPaymentFailureEmail({ to, name, reason: pay?.errorMessage ?? "결제에 실패했어요.", retryDate: sub.nextBillingDate ?? undefined });
      return;
    case "cancellation":
      await dispatchCancellationEmail({ to, name, accessUntil: sub.cancelEffectiveAt ?? sub.nextBillingDate ?? new Date() });
      return;
    case "auto_downgrade":
      await dispatchAutoDowngradeEmail({ to, name });
      return;
    case "uncancel":
      return;
  }
};

const MONTHLY_PRO_KRW = 19900;
const YEARLY_PRO_KRW = 199000;

function nextBillingDateFromAmount(base: Date, amount: number): Date {
  const next = new Date(base);
  if (amount === YEARLY_PRO_KRW) {
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }
  next.setMonth(next.getMonth() + 1);
  return next;
}

export async function recordPaymentResult(
  params: RecordPaymentParams,
  deps?: { prismaClient?: PrismaLike; mailer?: PaymentMailer },
): Promise<{ payment: Payment; subscription: Subscription }> {
  const prismaClient = deps?.prismaClient ?? (prisma as unknown as PrismaLike);
  // When tests inject a mock prismaClient without a mailer, default to noop
  // to avoid touching the real prisma singleton inside defaultMailer.
  const mailer = deps?.mailer ?? (deps?.prismaClient ? noopMailer : defaultMailer);

  return prismaClient.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({ where: { id: params.subscriptionId } });
    if (!subscription) throw new Error(`Subscription not found: ${params.subscriptionId}`);

    const result = params.paymentResult;
    const isRefund = (result.raw as { refunded?: boolean } | undefined)?.refunded === true || result.amount < 0;
    const nextStateEvent = isRefund
      ? { kind: "refunded" as const }
      : result.paid
        ? {
            kind: "charge_succeeded" as const,
            nextBillingDate: nextBillingDateFromAmount(subscription.nextBillingDate ?? new Date(), result.amount),
            amount: result.amount,
            currency: result.currency,
          }
        : {
            kind: "charge_failed" as const,
            attempt: ((subscription.failedRetryCount + 1 >= 3 ? 3 : subscription.failedRetryCount + 1) as 1 | 2 | 3),
            errorCode: result.failureReason?.code,
            errorMessage: result.failureReason?.message,
          };

    const transitioned = transition(subscription.billingState, nextStateEvent);
    const paymentStatus = isRefund ? "refunded" : result.paid ? "completed" : "failed";

    const payment = await tx.payment.upsert({
      where: { orderId: result.orderId },
      update: {
        providerPaymentId: result.providerPaymentId,
        providerTransactionId: result.providerTransactionId ?? result.providerPaymentId,
        paymentType: result.paymentType ?? "one_shot",
        status: paymentStatus,
        errorCode: result.failureReason?.code ?? null,
        errorMessage: result.failureReason?.message ?? null,
        cardName: result.cardName ?? null,
        cardNum: result.last4 ?? null,
        paidAt: result.paidAt ?? new Date(),
      },
      create: {
        subscriptionId: params.subscriptionId,
        userId: subscription.userId,
        orderId: result.orderId,
        providerPaymentId: result.providerPaymentId,
        providerTransactionId: result.providerTransactionId ?? result.providerPaymentId,
        paymentType: result.paymentType ?? "one_shot",
        status: paymentStatus,
        errorCode: result.failureReason?.code ?? null,
        errorMessage: result.failureReason?.message ?? null,
        cardName: result.cardName ?? null,
        cardNum: result.last4 ?? null,
        paidAt: result.paidAt ?? new Date(),
      },
    });

    if (result.paymentType === "recurring") {
      const periodStart = subscription.nextBillingDate ?? new Date();
      const periodEnd = nextBillingDateFromAmount(periodStart, Math.abs(result.amount));
      await tx.invoice.upsert({
        where: { subscriptionId_periodStart: { subscriptionId: params.subscriptionId, periodStart } },
        update: { amount: Math.abs(result.amount), paymentId: payment.id, status: paymentStatus, periodEnd },
        create: {
          subscriptionId: params.subscriptionId,
          userId: subscription.userId,
          periodStart,
          periodEnd,
          amount: Math.abs(result.amount),
          currency: result.currency,
          status: paymentStatus,
          paymentId: payment.id,
        },
      });
    }

    const patch = {
      ...transitioned.patch,
      tier: result.paid && (result.amount === MONTHLY_PRO_KRW || result.amount === YEARLY_PRO_KRW) ? "pro" : subscription.tier,
      billingState: result.paid
        ? "active"
        : subscription.failedRetryCount + 1 >= 3
          ? "canceled_grace"
          : "pending_retry",
    };

    const subscriptionUpdated = await tx.subscription.update({ where: { id: params.subscriptionId }, data: patch });

    if (transitioned.email) {
      await mailer({ subscriptionId: params.subscriptionId, email: transitioned.email, paymentId: payment.id });
    }

    return { payment, subscription: subscriptionUpdated };
  });
}
