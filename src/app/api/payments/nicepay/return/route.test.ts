import { describe, expect, it, vi, beforeEach } from "vitest";

const { approveMock, recordMock } = vi.hoisted(() => ({
  approveMock: vi.fn(),
  recordMock: vi.fn(),
}));

vi.mock("@/lib/nicepay", () => ({
  signReturnUrl: vi.fn(() => "sig"),
  timingSafeEqual: vi.fn((a: string, b: string) => a === b),
  payments: { approve: approveMock },
  toProviderPaymentResult: vi.fn((raw: { orderId: string; tid: string; amount: number }) => ({
    orderId: raw.orderId,
    providerPaymentId: raw.tid,
    providerTransactionId: raw.tid,
    status: "paid",
    amount: raw.amount,
    currency: "KRW",
  })),
}));

vi.mock("@/lib/billing/record-payment", () => ({ recordPaymentResult: recordMock }));

const payment = { id: "p1", orderId: "o1", status: "pending", amount: 19900, userId: "u1", subscriptionId: "s1" };
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    payment: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    auditLog: { create: vi.fn() },
    billingKey: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POST } from "./route";

const req = (overrides: Record<string, string>) => {
  const params = new URLSearchParams({ authResultCode: "0000", tid: "t1", orderId: "o1", amount: "19900", signature: "sig", ediDate: "2026-01-01T00:00:00+09:00", ...overrides });
  return new Request("https://x", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
};

describe("nicepay return route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.payment.findUnique.mockResolvedValue(payment);
    prismaMock.payment.count.mockResolvedValue(0);
    prismaMock.billingKey.findFirst.mockResolvedValue(null);
    approveMock.mockResolvedValue({ resultCode: "0000", orderId: "o1", tid: "t1", amount: 19900 });
  });

  it("happy path", async () => {
    const res = await POST(req({ method: "card" }));
    expect(approveMock).toHaveBeenCalled();
    expect(recordMock).toHaveBeenCalled();
    expect(res.status).toBe(303);
  });

  it("auth fail", async () => {
    const res = await POST(req({ authResultCode: "9999" }));
    expect(res.headers.get("location")).toContain("reason=auth_9999");
  });
});
