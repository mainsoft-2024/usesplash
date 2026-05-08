// NOTE: This module depends on Prisma-generated Subscription fields existing in schema.
export type BillingState = "free" | "active" | "pending_retry" | "canceled_grace" | "expired";

export type EmailKind =
  | "payment_success"
  | "payment_failure"
  | "cancellation"
  | "auto_downgrade"
  | "uncancel";

export type SubscriptionPatch = Partial<{
  tier: "free" | "pro";
  billingKey: string | null;
  billingKeyType: string | null;
  paymentMethod: string | null;
  currency: "KRW" | "USD" | null;
  nextBillingDate: Date | null;
  failedRetryCount: number;
  canceledAt: Date | null;
  cancelReason: string | null;
}>;

export type BillingEvent =
  | {
      kind: "charge_succeeded";
      nextBillingDate: Date;
      amount: number;
      currency: "KRW" | "USD";
    }
  | {
      kind: "charge_failed";
      attempt: 1 | 2 | 3;
      errorCode?: string;
      errorMessage?: string;
    }
  | {
      kind: "user_canceled";
      reason?: string;
      accessUntil: Date;
    }
  | { kind: "user_uncanceled" }
  | { kind: "grace_expired" }
  | { kind: "refunded" };

export type TransitionResult = {
  state: BillingState;
  patch: SubscriptionPatch;
  email?: EmailKind;
};

function illegal(state: BillingState, event: BillingEvent): never {
  throw new Error(`Illegal billing transition: ${state} -> ${event.kind}`);
}

function resetBillingPatch(): SubscriptionPatch {
  return {
    tier: "free",
    billingKey: null,
    billingKeyType: null,
    paymentMethod: null,
    nextBillingDate: null,
    failedRetryCount: 0,
    canceledAt: null,
    cancelReason: null,
  };
}

export function transition(state: BillingState, event: BillingEvent): TransitionResult {
  switch (event.kind) {
    case "charge_succeeded": {
      if (state === "expired") {
        return illegal(state, event);
      }

      return {
        state: "active",
        patch: {
          tier: "pro",
          currency: event.currency,
          nextBillingDate: event.nextBillingDate,
          failedRetryCount: 0,
          canceledAt: null,
          cancelReason: null,
        },
        email: "payment_success",
      };
    }

    case "charge_failed": {
      if (state === "free" || state === "expired") {
        return illegal(state, event);
      }

      if (event.attempt === 3) {
        return {
          state: "expired",
          patch: resetBillingPatch(),
          email: "auto_downgrade",
        };
      }

      return {
        state: "pending_retry",
        patch: {
          failedRetryCount: event.attempt,
        },
        email: "payment_failure",
      };
    }

    case "user_canceled": {
      if (state !== "active") {
        return illegal(state, event);
      }

      return {
        state: "canceled_grace",
        patch: {
          tier: "pro",
          canceledAt: new Date(),
          cancelReason: event.reason ?? null,
          nextBillingDate: event.accessUntil,
        },
        email: "cancellation",
      };
    }

    case "user_uncanceled": {
      if (state !== "canceled_grace") {
        return illegal(state, event);
      }

      return {
        state: "active",
        patch: {
          canceledAt: null,
          cancelReason: null,
        },
        email: "uncancel",
      };
    }

    case "grace_expired": {
      if (state !== "canceled_grace") {
        return illegal(state, event);
      }

      return {
        state: "expired",
        patch: resetBillingPatch(),
        email: "auto_downgrade",
      };
    }

    case "refunded": {
      if (state !== "active") {
        return illegal(state, event);
      }

      return {
        state: "active",
        patch: {
          failedRetryCount: 0,
        },
      };
    }
  }
}
