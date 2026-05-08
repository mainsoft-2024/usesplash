import { env } from "@/lib/env";

export const PLANS = ["monthly", "yearly"] as const;
export type Plan = (typeof PLANS)[number];

const MONTHLY_AMOUNT = env.PRICE_PRO_MONTH_KRW;
const YEARLY_AMOUNT = env.PRICE_PRO_YEAR_KRW;

for (const [plan, amount] of [["monthly", MONTHLY_AMOUNT], ["yearly", YEARLY_AMOUNT]] as const) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`Invalid ${plan} price: ${String(amount)}`);
  }
}

export function getPricing() {
  return { monthly: MONTHLY_AMOUNT, yearly: YEARLY_AMOUNT, currency: "KRW" as const };
}

export function getPlanAmount(plan: Plan): number {
  return plan === "monthly" ? MONTHLY_AMOUNT : YEARLY_AMOUNT;
}

export function getPeriodAdvance(plan: Plan): { months: number } {
  return { months: plan === "monthly" ? 1 : 12 };
}

export function getGoodsName(plan: Plan): string {
  return plan === "monthly" ? "Splash Pro 월간" : "Splash Pro 연간";
}
