import { beforeEach, describe, expect, it, vi } from "vitest";

const recordPaymentResult = vi.fn();
const signWebhook = vi.fn();
const timingSafeEqual = vi.fn();

const prismaMock = {
  webhookEvent: { create: vi.fn(), update: vi.fn() },
  payment: { update: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock("@/lib/billing/record-payment", () => ({ recordPaymentResult }));
vi.mock("@/lib/nicepay/signature", () => ({ signWebhook, timingSafeEqual }));
vi.mock("@/lib/env", () => ({ env: { NICEPAY_SECRET_KEY: "secret", NICEPAY_CLIENT_ID: "cid" } }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

describe("POST /api/webhooks/nicepay", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    signWebhook.mockReturnValue("expected-sign");
    timingSafeEqual.mockReturnValue(true);
    prismaMock.webhookEvent.create.mockResolvedValue({});
    prismaMock.webhookEvent.update.mockResolvedValue({});
    prismaMock.payment.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    recordPaymentResult.mockResolvedValue({});
  });

  it("returns 400 invalid_json", async () => {
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/webhooks/nicepay", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "invalid_json" });
  });

  it("returns 400 on invalid signature and persists invalid webhook row", async () => {
    timingSafeEqual.mockReturnValue(false);
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/nicepay", {
        method: "POST",
        body: JSON.stringify({ eventId: "evt-1", type: "recurring_paid", signData: "bad", tid: "tid", ediDate: "20260101", orderId: "o1", amount: 19900 }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "invalid_signature" });
    expect(prismaMock.webhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventId: "evt-1", signatureValid: false, processingError: "invalid_signature" }) }),
    );
  });

  it("handles first recurring_paid delivery, calls recordPaymentResult, and marks processed", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/nicepay", {
        method: "POST",
        body: JSON.stringify({ eventId: "evt-2", type: "recurring_paid", signData: "ok", tid: "tid-2", orderId: "o2", subscriptionId: "s2", amount: 19900 }),
      }),
    );
    expect(response.status).toBe(200);
    expect(recordPaymentResult).toHaveBeenCalledTimes(1);
    expect(prismaMock.webhookEvent.update).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: "evt-2" }, data: expect.objectContaining({ processedAt: expect.any(Date) }) }));
  });

  it("returns replay=true on P2002 and skips recordPaymentResult", async () => {
    const replayError = { code: "P2002" };
    prismaMock.webhookEvent.create.mockRejectedValue(replayError);
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/nicepay", {
        method: "POST",
        body: JSON.stringify({ eventId: "evt-3", type: "recurring_paid", signData: "ok", tid: "tid-3", orderId: "o3", subscriptionId: "s3", amount: 19900 }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, replay: true });
    expect(recordPaymentResult).not.toHaveBeenCalled();
  });

  it("writes AuditLog for unknown type and returns 200", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/nicepay", {
        method: "POST",
        body: JSON.stringify({ eventId: "evt-4", type: "mystery", signData: "ok", tid: "tid-4", orderId: "o4", amount: 1000 }),
      }),
    );
    expect(response.status).toBe(200);
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("marks payment failed on vbankExpired", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/nicepay", {
        method: "POST",
        body: JSON.stringify({ eventId: "evt-5", type: "vbankExpired", signData: "ok", orderId: "o5", amount: 1000 }),
      }),
    );
    expect(response.status).toBe(200);
    expect(prismaMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: "o5" }, data: expect.objectContaining({ status: "failed", errorCode: "vbank_expired" }) }),
    );
  });

  it("stores processingError when dispatch throws and still returns 200", async () => {
    recordPaymentResult.mockRejectedValue(new Error("dispatch failed"));
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/nicepay", {
        method: "POST",
        body: JSON.stringify({ eventId: "evt-6", type: "recurring_paid", signData: "ok", tid: "tid-6", orderId: "o6", subscriptionId: "s6", amount: 19900 }),
      }),
    );
    expect(response.status).toBe(200);
    expect(prismaMock.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: "evt-6" }, data: { processingError: "dispatch failed" } }),
    );
  });
});
