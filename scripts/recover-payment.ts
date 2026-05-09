/**
 * One-time manual recovery for a NICE payment that succeeded at PG but
 * failed to persist due to the upsert paymentMethod NOT NULL bug.
 *
 * Usage: pnpm tsx scripts/recover-payment.ts
 *
 * Idempotent: safe to re-run; will only mutate if the row is still pending.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadDotEnv } from "dotenv";
loadDotEnv();

const ORDER_ID = "splash_cmowu2kr_1778240500_DiVA";
const TID = "UT0031147m01012605082042134304";
const PAID_AT = new Date("2026-05-08T11:42:17.000Z");

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const payment = await prisma.payment.findUnique({ where: { orderId: ORDER_ID } });
    if (!payment) {
      console.error(`Payment row not found for orderId=${ORDER_ID}`);
      process.exit(1);
    }

    if (payment.status === "completed") {
      console.log("Payment already marked completed, nothing to do.");
    } else {
      const updated = await prisma.payment.update({
        where: { orderId: ORDER_ID },
        data: {
          providerPaymentId: TID,
          providerTransactionId: TID,
          paymentMethod: "card",
          paymentType: "one_shot",
          status: "completed",
          paidAt: PAID_AT,
          errorCode: null,
          errorMessage: null,
        },
      });
      console.log("Payment updated:", { id: updated.id, status: updated.status, paidAt: updated.paidAt });
    }

    const subscription = await prisma.subscription.findUnique({ where: { id: payment.subscriptionId } });
    if (!subscription) {
      console.error(`Subscription not found for id=${payment.subscriptionId}`);
      process.exit(1);
    }

    if (subscription.tier === "pro" && subscription.billingState === "active") {
      console.log("Subscription already active+pro, nothing to do.");
    } else {
      const next = new Date(PAID_AT);
      // Pro monthly = 19,900원 → +1 month. Pro yearly would be +12 months.
      if (payment.amount === 199_000) next.setFullYear(next.getFullYear() + 1);
      else next.setMonth(next.getMonth() + 1);

      const updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          tier: "pro",
          billingState: "active",
          nextBillingDate: next,
          failedRetryCount: 0,
          canceledAt: null,
          cancelReason: null,
        },
      });
      console.log("Subscription updated:", {
        id: updated.id,
        tier: updated.tier,
        billingState: updated.billingState,
        nextBillingDate: updated.nextBillingDate,
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Recovery failed:", err);
  process.exit(1);
});
