/**
 * Backfill receiptUrl for an already-recorded payment by querying NICE.
 *
 * Usage: pnpm exec tsx scripts/backfill-receipt-url.ts
 */
import { config as loadDotEnv } from "dotenv";
loadDotEnv({ path: ".env", override: true });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as nicepay from "../src/lib/nicepay";

const ORDER_ID = "splash_cmowu2kr_1778240500_DiVA";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const payment = await prisma.payment.findUnique({ where: { orderId: ORDER_ID } });
    if (!payment) {
      console.error(`Payment not found for orderId=${ORDER_ID}`);
      process.exit(1);
    }
    if (!payment.providerPaymentId) {
      console.error("Payment has no providerPaymentId (tid).");
      process.exit(1);
    }

    console.log(`Querying NICE for tid=${payment.providerPaymentId}...`);
    const nice = await nicepay.payments.findByTid(payment.providerPaymentId);
    console.log("NICE response keys:", Object.keys(nice));
    const receiptUrl = (nice as { receiptUrl?: string }).receiptUrl;
    if (!receiptUrl) {
      console.error("NICE did not return receiptUrl. Full response:", JSON.stringify(nice, null, 2));
      process.exit(1);
    }
    console.log("receiptUrl:", receiptUrl);

    const updated = await prisma.payment.update({
      where: { orderId: ORDER_ID },
      data: { receiptUrl },
    });
    console.log("Backfilled. Payment:", { id: updated.id, receiptUrl: updated.receiptUrl });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
