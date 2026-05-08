import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  tags?: Array<{ name: string; value: string }>;
};

export type SendEmailResult =
  | { id: string }
  | { skipped: true }
  | { error: string };

export async function sendEmail({
  to,
  subject,
  react,
  tags,
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { skipped: true };
  }

  const emailFrom = process.env.EMAIL_FROM?.trim();
  if (!emailFrom) {
    return { error: "EMAIL_FROM is not configured" };
  }

  try {
    const html = await render(react);
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({
      from: emailFrom,
      to,
      subject,
      html,
      tags,
    });

    if (response.error) {
      return { error: response.error.message ?? "Failed to send email" };
    }

    if (!response.data?.id) {
      return { error: "Email ID missing from Resend response" };
    }

    return { id: response.data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: message };
  }
}
