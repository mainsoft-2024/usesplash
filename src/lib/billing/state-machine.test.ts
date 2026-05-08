import { describe, expect, it } from "vitest";
import { transition, type BillingEvent, type BillingState } from "./state-machine";

type Cell = {
  state: BillingState;
  event: BillingEvent;
  allowed: boolean;
  expectedState?: BillingState;
  expectedEmail?: string;
};

const successEvent: BillingEvent = {
  kind: "charge_succeeded",
  nextBillingDate: new Date("2026-06-01T00:00:00.000Z"),
  amount: 12900,
  currency: "KRW",
};

const fail1: BillingEvent = { kind: "charge_failed", attempt: 1, errorCode: "E1" };
const canceled: BillingEvent = {
  kind: "user_canceled",
  reason: "user request",
  accessUntil: new Date("2026-06-01T00:00:00.000Z"),
};
const uncancel: BillingEvent = { kind: "user_uncanceled" };
const graceExpired: BillingEvent = { kind: "grace_expired" };
const refunded: BillingEvent = { kind: "refunded" };

const matrix: Cell[] = [
  { state: "free", event: successEvent, allowed: true, expectedState: "active", expectedEmail: "payment_success" },
  { state: "free", event: fail1, allowed: false },
  { state: "free", event: canceled, allowed: false },
  { state: "free", event: uncancel, allowed: false },
  { state: "free", event: graceExpired, allowed: false },
  { state: "free", event: refunded, allowed: false },

  { state: "active", event: successEvent, allowed: true, expectedState: "active", expectedEmail: "payment_success" },
  { state: "active", event: fail1, allowed: true, expectedState: "pending_retry", expectedEmail: "payment_failure" },
  { state: "active", event: canceled, allowed: true, expectedState: "canceled_grace", expectedEmail: "cancellation" },
  { state: "active", event: uncancel, allowed: false },
  { state: "active", event: graceExpired, allowed: false },
  { state: "active", event: refunded, allowed: true, expectedState: "active" },

  { state: "pending_retry", event: successEvent, allowed: true, expectedState: "active", expectedEmail: "payment_success" },
  { state: "pending_retry", event: fail1, allowed: true, expectedState: "pending_retry", expectedEmail: "payment_failure" },
  { state: "pending_retry", event: canceled, allowed: false },
  { state: "pending_retry", event: uncancel, allowed: false },
  { state: "pending_retry", event: graceExpired, allowed: false },
  { state: "pending_retry", event: refunded, allowed: false },

  {
    state: "canceled_grace",
    event: successEvent,
    allowed: true,
    expectedState: "active",
    expectedEmail: "payment_success",
  },
  { state: "canceled_grace", event: refunded, allowed: false },
  {
    state: "canceled_grace",
    event: fail1,
    allowed: true,
    expectedState: "pending_retry",
    expectedEmail: "payment_failure",
  },
  { state: "canceled_grace", event: canceled, allowed: false },
  { state: "canceled_grace", event: uncancel, allowed: true, expectedState: "active", expectedEmail: "uncancel" },
  {
    state: "canceled_grace",
    event: graceExpired,
    allowed: true,
    expectedState: "expired",
    expectedEmail: "auto_downgrade",
  },

  { state: "expired", event: successEvent, allowed: false },
  { state: "expired", event: fail1, allowed: false },
  { state: "expired", event: canceled, allowed: false },
  { state: "expired", event: uncancel, allowed: false },
  { state: "expired", event: graceExpired, allowed: false },
  { state: "expired", event: refunded, allowed: false },
];

describe("billing transition matrix", () => {
  it("covers all 30 state-event cells", () => {
    expect(matrix).toHaveLength(30);
  });

  it.each(matrix)("$state + $event.kind", ({ state, event, allowed, expectedState, expectedEmail }) => {
    if (!allowed) {
      expect(() => transition(state, event)).toThrowError(/Illegal billing transition/);
      return;
    }

    const result = transition(state, event);
    expect(result.state).toBe(expectedState);
    expect(result.email).toBe(expectedEmail);
  });

  it("charge_failed attempt=2 keeps pending_retry", () => {
    const result = transition("active", { kind: "charge_failed", attempt: 2 });
    expect(result.state).toBe("pending_retry");
    expect(result.patch.failedRetryCount).toBe(2);
    expect(result.email).toBe("payment_failure");
  });

  it("charge_failed attempt=3 expires and resets billing", () => {
    const result = transition("active", { kind: "charge_failed", attempt: 3 });
    expect(result.state).toBe("expired");
    expect(result.patch.tier).toBe("free");
    expect(result.patch.billingKey).toBeNull();
    expect(result.patch.nextBillingDate).toBeNull();
    expect(result.patch.failedRetryCount).toBe(0);
    expect(result.email).toBe("auto_downgrade");
  });
});
