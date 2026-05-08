import { render } from "@react-email/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentSuccessEmail } from "./templates/PaymentSuccessEmail";

const sendMock = vi.fn();
const constructorMock = vi.fn();

vi.mock("resend", () => {
  return {
    Resend: vi.fn((apiKey: string) => {
      constructorMock(apiKey);
      return {
        emails: {
          send: sendMock,
        },
      };
    }),
  };
});

describe("sendEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.EMAIL_FROM = "Splash <noreply@usesplash.com>";
    delete process.env.RESEND_API_KEY;
  });

  it("returns skipped when RESEND_API_KEY is missing", async () => {
    const { sendEmail } = await import("./client");

    const result = await sendEmail({
      to: "user@example.com",
      subject: "test",
      react: <div>hello</div>,
    });

    expect(result).toEqual({ skipped: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns error when resend throws", async () => {
    process.env.RESEND_API_KEY = "re_test";
    sendMock.mockRejectedValueOnce(new Error("boom"));

    const { sendEmail } = await import("./client");
    const result = await sendEmail({
      to: "user@example.com",
      subject: "test",
      react: <div>hello</div>,
    });

    expect(result).toEqual({ error: "boom" });
  });

  it("returns id on successful send and renders non-empty html", async () => {
    process.env.RESEND_API_KEY = "re_test";
    sendMock.mockResolvedValueOnce({
      data: { id: "email_123" },
      error: null,
    });

    const { sendEmail } = await import("./client");
    const result = await sendEmail({
      to: "user@example.com",
      subject: "ok",
      react: (
        <PaymentSuccessEmail
          amount={9900}
          plan="Splash Pro"
          orderId="order_1"
          paidAt={new Date("2026-05-01T00:00:00.000Z")}
          providerPaymentId="tid_1"
        />
      ),
    });

    expect(result).toEqual({ id: "email_123" });
    expect(constructorMock).toHaveBeenCalledWith("re_test");
    expect(sendMock).toHaveBeenCalledTimes(1);

    const payload = sendMock.mock.calls[0]?.[0] as { html?: string };
    expect(typeof payload.html).toBe("string");
    expect(payload.html?.trim().length).toBeGreaterThan(0);

    const html = await render(
      <PaymentSuccessEmail
        amount={19900}
        plan="Splash Pro"
        orderId="order_2"
        paidAt={new Date("2026-05-01T00:00:00.000Z")}
        providerPaymentId="tid_2"
      />
    );
    expect(html.trim().length).toBeGreaterThan(0);
  });
});
