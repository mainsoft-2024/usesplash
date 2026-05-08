import { initTRPC } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

const t = initTRPC.context<{ session: { user: { id: string; name?: string | null; email?: string | null } }; prisma: Record<string, unknown> }>().create();

vi.mock("@/lib/trpc/server", () => ({ router: t.router, protectedProcedure: t.procedure }));
vi.mock("./_admin-procedure", () => ({ adminProcedure: t.procedure }));
vi.mock("@/lib/email", () => ({ dispatchRefundConfirmationEmail: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/nicepay", () => ({
  generateOrderId: vi.fn().mockReturnValue("splash_user1234_1700000000_ABCD"),
  payments: { cancel: vi.fn().mockResolvedValue({ resultCode: "0000", resultMsg: "ok", tid: "mocktid", amount: 1000 }) },
  billingKeys: { expire: vi.fn().mockResolvedValue({ resultCode: "0000", resultMsg: "ok", tid: "t", bid: "b", orderId: "o" }) },
}));
vi.mock("@/lib/billing/record-payment", () => ({ recordPaymentResult: vi.fn().mockResolvedValue({}) }));

const { paymentRouter } = await import("./payment");

function caller(prisma: Record<string, unknown>, userId = "user1") {
  return paymentRouter.createCaller({ session: { user: { id: userId, name: "n", email: "e@test.com" } }, prisma } as never);
}

describe("paymentRouter", () => {
  it("createCheckoutSession happy path", async () => {
    const prisma = { subscription: { findUnique: vi.fn().mockResolvedValue({ id: "s1" }) }, payment: { create: vi.fn().mockResolvedValue({}) } };
    const result = await caller(prisma).createCheckoutSession({ plan: "monthly" });
    expect(result.orderId).toMatch(/^splash_/);
    expect(result.amount).toBeGreaterThan(0);
  });

  it("cancelSubscription active -> canceled_grace", async () => {
    const prisma = { subscription: { findUnique: vi.fn().mockResolvedValue({ id: "s1", nextBillingDate: null }), update: vi.fn().mockResolvedValue({ billingState: "canceled_grace" }) } };
    const result = await caller(prisma).cancelSubscription();
    expect(result.billingState).toBe("canceled_grace");
  });

  it("listPayments paginates", async () => {
    const prisma = { payment: { findMany: vi.fn().mockResolvedValue([{ id: "1" }, { id: "2" }, { id: "3" }]) } };
    const result = await caller(prisma).listPayments({ limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("3");
  });
});
