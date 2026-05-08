// Vitest global setup — provide env vars expected by src/lib/env.ts so
// modules that strictly validate env at import time can load in tests.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.NEXTAUTH_SECRET ??= "test-nextauth-secret-32-bytes-padding";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.GOOGLE_CLIENT_ID ??= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-google-client-secret";
process.env.OPENROUTER_API_KEY ??= "test-openrouter-key";
process.env.OPENROUTER_MODEL ??= "google/gemini-3-flash-preview";
process.env.GEMINI_API_KEY ??= "test-gemini-key";
process.env.BLOB_READ_WRITE_TOKEN ??= "test-blob-token";
process.env.NICEPAY_MODE ??= "test";
process.env.NICEPAY_CLIENT_ID ??= "test-nicepay-client-id";
// Secret key MUST be exactly 32 bytes for AES-256-CBC.
process.env.NICEPAY_SECRET_KEY ??= "0123456789abcdef0123456789abcdef";
process.env.NICEPAY_API_BASE ??= "https://api.nicepay.co.kr";
process.env.NICEPAY_JS_SDK_URL ??= "https://pay.nicepay.co.kr/v1/js/";
process.env.PRICE_PRO_MONTH_KRW ??= "19900";
process.env.PRICE_PRO_YEAR_KRW ??= "199000";
process.env.CRON_SECRET ??= "test-cron-secret";
process.env.NEXT_PUBLIC_PAYMENTS_ENABLED ??= "false";
