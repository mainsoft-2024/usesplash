import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  REMOVE_BG_API_KEY: z.string().optional(),
  RECRAFT_API_KEY: z.string().optional(),
  NICEPAY_MODE: z.enum(["test", "live"]),
  NICEPAY_CLIENT_ID: z.string().min(1),
  NICEPAY_SECRET_KEY: z.string().min(1),
  NICEPAY_API_BASE: z.string().url(),
  NICEPAY_JS_SDK_URL: z.string().url(),
  PRICE_PRO_MONTH_KRW: z.coerce.number().int().positive(),
  PRICE_PRO_YEAR_KRW: z.coerce.number().int().positive(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().min(1),
  NEXT_PUBLIC_PAYMENTS_ENABLED: z.enum(["true", "false"]),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(
    `Invalid environment variables: ${parsedEnv.error.issues
      .map((issue) => issue.path.join(".") + ": " + issue.message)
      .join(", ")}`
  );
}

if (parsedEnv.data.NICEPAY_MODE === "live" && process.env.VERCEL_ENV !== "production") {
  throw new Error("NICEPAY_MODE=live is only allowed when VERCEL_ENV=production");
}

export const env = parsedEnv.data;
export type Env = typeof env;
