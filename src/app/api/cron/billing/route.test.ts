import { describe, expect, it, vi } from "vitest";
import { __test__ } from "./route";

function req(auth?: string) {
  return new Request("http://localhost/api/cron/billing", { headers: auth ? { authorization: auth } : {} });
}

describe("cron billing route", () => {
  it("auth missing -> 401", async () => {
    const res = await __test__.handleRun(req(), { prismaClient: {} as never, approve: vi.fn(), recordPayment: vi.fn(), now: () => new Date() });
    expect(res.status).toBe(401);
  });
});
