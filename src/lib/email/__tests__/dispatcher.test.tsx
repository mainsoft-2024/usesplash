import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();

vi.mock("../client", () => ({ sendEmail }));

describe("dispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmail.mockResolvedValue({ id: "email_1" });
  });

  it("dispatches payment success", async () => {
    const { dispatchPaymentSuccessEmail } = await import("../dispatcher");
    await dispatchPaymentSuccessEmail({ to: "a@test.com", name: "홍길동", plan: "Pro 월간", amount: 19900, orderId: "o1", paidAt: new Date("2026-05-08T00:00:00.000Z"), providerPaymentId: "tid_1" });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "a@test.com", subject: expect.stringContaining("결제") }));
  });

  it("dispatches payment failure", async () => {
    const { dispatchPaymentFailureEmail } = await import("../dispatcher");
    await dispatchPaymentFailureEmail({ to: "a@test.com", reason: "한도 초과" });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining("실패") }));
  });

  it("dispatches cancellation", async () => {
    const { dispatchCancellationEmail } = await import("../dispatcher");
    await dispatchCancellationEmail({ to: "a@test.com", accessUntil: new Date("2026-06-30T00:00:00.000Z") });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining("취소") }));
  });

  it("dispatches auto downgrade", async () => {
    const { dispatchAutoDowngradeEmail } = await import("../dispatcher");
    await dispatchAutoDowngradeEmail({ to: "a@test.com" });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining("자동 전환") }));
  });

  it("dispatches refund confirmation", async () => {
    const { dispatchRefundConfirmationEmail } = await import("../dispatcher");
    await dispatchRefundConfirmationEmail({ to: "a@test.com", amount: 19900, orderId: "o1", refundedAt: new Date("2026-05-08T00:00:00.000Z") });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining("환불") }));
  });
});
