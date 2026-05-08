import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as nicepay from "@/lib/nicepay";
import { env } from "@/lib/env";
import { router, protectedProcedure } from "@/lib/trpc/server";
import { adminProcedure } from "./_admin-procedure";
import { recordPaymentResult } from "@/lib/billing/record-payment";
import { dispatchRefundConfirmationEmail } from "@/lib/email";
import { getGoodsName, getPlanAmount, getPricing, type Plan } from "@/lib/payments/pricing";

const planSchema = z.enum(["monthly", "yearly"]);

async function getOrCreateSubscriptionId(prisma: { subscription: { findUnique: (args: unknown) => Promise<{ id: string } | null>; create: (args: unknown) => Promise<{ id: string }> } }, userId: string) {
  const existing = await prisma.subscription.findUnique({ where: { userId }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.subscription.create({ data: { userId } });
  return created.id;
}

export const paymentRouter = router({
  getPricing: protectedProcedure.query(() => getPricing()),

  createCheckoutSession: protectedProcedure
    .input(z.object({ plan: planSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const amount = getPlanAmount(input.plan as Plan);
      const subscriptionId = await getOrCreateSubscriptionId(ctx.prisma as never, userId);

      let orderId = "";
      for (let i = 0; i < 3; i += 1) {
        orderId = nicepay.generateOrderId(userId);
        try {
          await ctx.prisma.payment.create({
            data: { orderId, amount, currency: "KRW", status: "pending", userId, paymentType: "one_shot", paymentMethod: "card", subscriptionId },
          });
          break;
        } catch (error) {
          if (i === 2) throw error;
        }
      }

      return {
        orderId,
        amount,
        goodsName: getGoodsName(input.plan as Plan),
        currency: "KRW" as const,
        returnUrl: `${env.NEXT_PUBLIC_APP_URL}/api/payments/nicepay/return`,
        jsSdkUrl: env.NICEPAY_JS_SDK_URL,
        clientId: env.NICEPAY_CLIENT_ID,
        buyerName: ctx.session.user.name ?? undefined,
        buyerEmail: ctx.session.user.email ?? undefined,
      };
    }),

  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const now = new Date();
    const subscription = await ctx.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) throw new TRPCError({ code: "NOT_FOUND" });
    const cancelEffectiveAt = subscription.nextBillingDate ?? now;
    return ctx.prisma.subscription.update({ where: { id: subscription.id }, data: { billingState: "canceled_grace", cancelEffectiveAt } });
  }),

  uncancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const now = new Date();
    const subscription = await ctx.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) throw new TRPCError({ code: "NOT_FOUND" });
    if (subscription.billingState !== "canceled_grace" || !subscription.cancelEffectiveAt || subscription.cancelEffectiveAt <= now) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "취소 되돌리기 가능 기간이 아닙니다." });
    }
    return ctx.prisma.subscription.update({ where: { id: subscription.id }, data: { billingState: "active", cancelEffectiveAt: null } });
  }),

  listPayments: protectedProcedure
    .input(z.object({ cursor: z.string().nullish(), limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.payment.findMany({
        where: { userId: ctx.session.user.id },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: { id: true, orderId: true, status: true, amount: true, currency: true, providerPaymentId: true, createdAt: true, paidAt: true },
      });
      const nextCursor = rows.length > input.limit ? rows[input.limit]?.id : null;
      return { items: rows.slice(0, input.limit), nextCursor };
    }),

  requestRefund: protectedProcedure
    .input(z.object({ paymentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.prisma.payment.findUnique({ where: { id: input.paymentId } });
      if (!payment) throw new TRPCError({ code: "NOT_FOUND" });
      if (payment.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (payment.status !== "completed" && payment.status !== "paid") throw new TRPCError({ code: "BAD_REQUEST" });
      if (!payment.providerPaymentId) throw new TRPCError({ code: "BAD_REQUEST" });

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (payment.createdAt < sevenDaysAgo) throw new TRPCError({ code: "BAD_REQUEST" });

      const usageCount = await ctx.prisma.usageLog.count({ where: { userId: ctx.session.user.id, createdAt: { gte: payment.createdAt } } });
      if (usageCount > 0) throw new TRPCError({ code: "BAD_REQUEST" });

      const canceled = await nicepay.payments.cancel({ tid: payment.providerPaymentId, opts: { reason: "사용자 요청 환불" } });
      await recordPaymentResult({
        subscriptionId: payment.subscriptionId,
        paymentResult: {
          orderId: payment.orderId,
          providerPaymentId: canceled.tid,
          providerTransactionId: canceled.tid,
          paid: false,
          amount: -Math.abs(payment.amount),
          currency: "KRW",
          paymentMethod: "card",
          paymentType: "one_shot",
          failureReason: canceled.resultCode === "0000" ? undefined : { code: canceled.resultCode, message: canceled.resultMsg },
          raw: { refunded: true },
        },
      });
      const userRow = await ctx.prisma.user.findUnique({ where: { id: ctx.session.user.id }, select: { email: true, name: true } });
      if (userRow?.email) {
        await dispatchRefundConfirmationEmail({ to: userRow.email, name: userRow.name ?? undefined, amount: payment.amount, orderId: payment.orderId, refundedAt: new Date() });
      }
      return { ok: true };
    }),

  requestPartialRefund: adminProcedure
    .input(z.object({ paymentId: z.string(), amount: z.number().int().positive(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.prisma.payment.findUnique({ where: { id: input.paymentId } });
      if (!payment) throw new TRPCError({ code: "NOT_FOUND" });
      if (!payment.providerPaymentId) throw new TRPCError({ code: "BAD_REQUEST" });
      const canceled = await nicepay.payments.cancel({ tid: payment.providerPaymentId, opts: { reason: input.reason, cancelAmt: input.amount } });
      await recordPaymentResult({
        subscriptionId: payment.subscriptionId,
        paymentResult: { orderId: payment.orderId, providerPaymentId: canceled.tid, providerTransactionId: canceled.tid, paid: false, amount: -Math.abs(input.amount), currency: "KRW", paymentMethod: "card", paymentType: "one_shot", raw: { refunded: true } },
      });
      return { ok: true };
    }),

  expireBillingKey: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const key = await ctx.prisma.billingKey.findFirst({ where: { userId: input.userId, isActive: true }, orderBy: { createdAt: "desc" } });
      if (!key) throw new TRPCError({ code: "NOT_FOUND" });
      await nicepay.billingKeys.expire({ bid: key.bid, orderId: nicepay.generateOrderId(input.userId) });
      await ctx.prisma.$transaction([
        ctx.prisma.billingKey.update({ where: { id: key.id }, data: { isActive: false } }),
        ctx.prisma.subscription.updateMany({ where: { userId: input.userId }, data: { activeBillingKeyId: null } }),
      ]);
      return { ok: true };
    }),
});
