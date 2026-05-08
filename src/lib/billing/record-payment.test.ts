/* eslint-disable @typescript-eslint/no-explicit-any -- vitest mock helpers; prisma generic shape is intentionally loose in this test fixture */
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { recordPaymentResult } from "./record-payment";
import type { ProviderPaymentResult } from "./types";

type FakePayment = { id: string; orderId: string; status: string };
type FakeSubscription = { id: string; userId: string; tier: string; billingState: "free" | "active" | "pending_retry" | "canceled_grace" | "expired"; failedRetryCount: number; nextBillingDate: Date | null };

function makePrisma(seed: { subscription: FakeSubscription }) {
  const db = { subscription: { ...seed.subscription }, payments: new Map<string, FakePayment>(), invoices: new Map<string, { key: string; paymentId: string }>() };
  const tx = {
    payment: { upsert: vi.fn(async (args: any) => { const key = args.where.orderId; const existing = db.payments.get(key); if (existing) { const updated = { ...existing, status: args.update.status }; db.payments.set(key, updated); return updated; } const created = { id: `pay_${db.payments.size + 1}`, orderId: key, status: args.create.status }; db.payments.set(key, created); return created; }) },
    invoice: { upsert: vi.fn(async (args: any) => { const key = `${args.where.subscriptionId_periodStart.subscriptionId}:${args.where.subscriptionId_periodStart.periodStart.toISOString()}`; const existing = db.invoices.get(key); if (existing) return existing; const created = { key, paymentId: args.create.paymentId }; db.invoices.set(key, created); return created; }) },
    subscription: { findUnique: vi.fn(async () => ({ ...db.subscription })), update: vi.fn(async (args: any) => { db.subscription = { ...db.subscription, ...args.data }; return { ...db.subscription }; }) },
  };
  return { prisma: { $transaction: vi.fn(async (fn: any) => fn(tx)) }, db };
}

const paidOneShot = (orderId: string): ProviderPaymentResult => ({ orderId, providerPaymentId: `tid_${orderId}`, paid: true, amount: 19900, currency: "KRW", paymentMethod: "card", paymentType: "one_shot", paidAt: new Date("2026-04-01T00:00:00.000Z") });
const paidRecurring = (orderId: string): ProviderPaymentResult => ({ ...paidOneShot(orderId), paymentType: "recurring" });
const failedRecurring = (orderId: string): ProviderPaymentResult => ({ orderId, providerPaymentId: `tid_${orderId}`, paid: false, amount: 19900, currency: "KRW", paymentMethod: "card", paymentType: "recurring", failureReason: { code: "DECLINED", message: "card declined" } });

describe("recordPaymentResult", () => {
  it("handles first paid one-shot", async () => {
    const { prisma, db } = makePrisma({ subscription: { id: "sub_1", userId: "u1", tier: "free", billingState: "free", failedRetryCount: 0, nextBillingDate: null } });
    await recordPaymentResult({ subscriptionId: "sub_1", paymentResult: paidOneShot("ord_1") }, { prismaClient: prisma as any });
    expect(db.subscription.tier).toBe("pro");
    expect(db.subscription.billingState).toBe("active");
  });

  it("handles recurring renewal success", async () => {
    const { prisma, db } = makePrisma({ subscription: { id: "sub_2", userId: "u2", tier: "pro", billingState: "pending_retry", failedRetryCount: 1, nextBillingDate: new Date("2026-04-15T00:00:00.000Z") } });
    await recordPaymentResult({ subscriptionId: "sub_2", paymentResult: paidRecurring("ord_2") }, { prismaClient: prisma as any });
    expect(db.subscription.billingState).toBe("active");
    expect(db.invoices.size).toBe(1);
  });

  it("handles recurring failure first retry", async () => {
    const { prisma, db } = makePrisma({ subscription: { id: "sub_3", userId: "u3", tier: "pro", billingState: "active", failedRetryCount: 0, nextBillingDate: new Date("2026-04-20T00:00:00.000Z") } });
    await recordPaymentResult({ subscriptionId: "sub_3", paymentResult: failedRecurring("ord_3") }, { prismaClient: prisma as any });
    expect(db.subscription.billingState).toBe("pending_retry");
  });

  it("handles refund", async () => {
    const { prisma, db } = makePrisma({ subscription: { id: "sub_4", userId: "u4", tier: "pro", billingState: "active", failedRetryCount: 0, nextBillingDate: new Date("2026-04-20T00:00:00.000Z") } });
    await recordPaymentResult({ subscriptionId: "sub_4", paymentResult: { ...paidRecurring("ord_4"), amount: -19900, raw: { refunded: true } } }, { prismaClient: prisma as any });
    expect(db.payments.get("ord_4")?.status).toBe("refunded");
  });

  it("is idempotent with same orderId", async () => {
    const { prisma, db } = makePrisma({ subscription: { id: "sub_5", userId: "u5", tier: "pro", billingState: "active", failedRetryCount: 0, nextBillingDate: new Date("2026-04-20T00:00:00.000Z") } });
    const payload = paidRecurring("ord_same");
    await recordPaymentResult({ subscriptionId: "sub_5", paymentResult: payload }, { prismaClient: prisma as any });
    await recordPaymentResult({ subscriptionId: "sub_5", paymentResult: payload }, { prismaClient: prisma as any });
    expect(db.payments.size).toBe(1);
  });
});
