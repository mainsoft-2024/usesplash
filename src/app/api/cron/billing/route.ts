import { recordPaymentResult } from "@/lib/billing/record-payment";
import type { ProviderPaymentResult } from "@/lib/billing/types";
import { env } from "@/lib/env";
import * as nicepay from "@/lib/nicepay";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH_SIZE = 200;

type Deps = {
  prismaClient: typeof prisma;
  approve: typeof nicepay.billingKeys.approve;
  recordPayment: typeof recordPaymentResult;
  now: () => Date;
  sendAutoDowngradeEmail?: (subscriptionId: string) => Promise<void>;
};

const defaultDeps: Deps = {
  prismaClient: prisma,
  approve: nicepay.billingKeys.approve,
  recordPayment: recordPaymentResult,
  now: () => new Date(),
};

function plusDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function plusMonths(base: Date, months: number): Date {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

function plusYears(base: Date, years: number): Date {
  const next = new Date(base);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function getRetryDate(base: Date, failedRetryCount: number): Date {
  if (failedRetryCount <= 1) return plusDays(base, 1);
  if (failedRetryCount === 2) return plusDays(base, 3);
  return plusDays(base, 7);
}

function getAmountFromCycle(cycle: string | null | undefined): number {
  return cycle === "yearly" ? env.PRICE_PRO_YEAR_KRW : env.PRICE_PRO_MONTH_KRW;
}

async function handleRun(request: Request, deps: Deps): Promise<Response> {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = deps.now();
  let renewed = 0;
  let failed = 0;
  let downgraded = 0;
  let cursor: string | undefined;

  while (true) {
    const subscriptions = await deps.prismaClient.subscription.findMany({
      where: { billingState: "active", nextBillingDate: { lte: now } },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { activeBillingKey: true },
    });
    if (subscriptions.length === 0) break;

    for (const subscription of subscriptions) {
      try {
        const periodStart = subscription.nextBillingDate ?? now;
        const amount = getAmountFromCycle(subscription.tier === "pro_yearly" ? "yearly" : "monthly");
        const periodEnd = amount === env.PRICE_PRO_YEAR_KRW ? plusYears(periodStart, 1) : plusMonths(periodStart, 1);

        await deps.prismaClient.invoice.upsert({
          where: { subscriptionId_periodStart: { subscriptionId: subscription.id, periodStart } },
          update: { status: "pending", amount, periodEnd, currency: "KRW" },
          create: {
            subscriptionId: subscription.id,
            userId: subscription.userId,
            periodStart,
            periodEnd,
            amount,
            currency: "KRW",
            status: "pending",
          },
        });

        const nextFailedCount = subscription.failedRetryCount + 1;
        if (!subscription.activeBillingKey) {
          await deps.prismaClient.subscription.update({
            where: { id: subscription.id },
            data: { billingState: "pending_retry", failedRetryCount: nextFailedCount, nextBillingDate: getRetryDate(now, nextFailedCount) },
          });
          failed += 1;
          continue;
        }

        const orderId = nicepay.generateOrderId(subscription.userId);
        const approveResult = await deps.approve({
          bid: subscription.activeBillingKey.bid,
          orderId,
          amount,
          goodsName: "Splash Pro",
          cardQuota: "0",
          useShopInterest: false,
        });

        if (approveResult.resultCode === "0000") {
          const paymentResult: ProviderPaymentResult = {
            orderId,
            providerPaymentId: approveResult.tid,
            providerTransactionId: approveResult.tid,
            paid: true,
            amount,
            currency: "KRW",
            paymentMethod: "card",
            paymentType: "recurring",
            paidAt: approveResult.paidAt ? new Date(approveResult.paidAt) : now,
            raw: approveResult,
          };
          await deps.recordPayment({ subscriptionId: subscription.id, paymentResult });
          renewed += 1;
        } else {
          if (nextFailedCount >= 4) {
            await deps.prismaClient.subscription.update({
              where: { id: subscription.id },
              data: { billingState: "canceled_grace", cancelEffectiveAt: plusDays(now, 7), nextBillingDate: null, failedRetryCount: nextFailedCount },
            });
          } else {
            await deps.prismaClient.subscription.update({
              where: { id: subscription.id },
              data: { billingState: "pending_retry", failedRetryCount: nextFailedCount, nextBillingDate: getRetryDate(now, nextFailedCount) },
            });
          }
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }

    cursor = subscriptions.at(-1)?.id;
  }

  const graceRows = await deps.prismaClient.subscription.findMany({
    where: { billingState: "canceled_grace", cancelEffectiveAt: { lte: now } },
    select: { id: true, userId: true },
  });

  for (const row of graceRows) {
    await deps.prismaClient.subscription.update({
      where: { id: row.id },
      data: { tier: "free", billingState: "expired", failedRetryCount: 0, activeBillingKeyId: null },
    });
    if (deps.sendAutoDowngradeEmail) {
      await deps.sendAutoDowngradeEmail(row.id);
    } else {
      await deps.prismaClient.auditLog.create({
        data: { actorId: null, targetUserId: row.userId, action: "email_dispatch_skipped", payload: { reason: "dispatcher_missing", source: "cron_billing" } },
      });
    }
    downgraded += 1;
  }

  return Response.json({ ok: true, processed: { renewed, failed, downgraded } });
}

export async function GET(request: Request) {
  return handleRun(request, defaultDeps);
}

export const __test__ = { handleRun };
