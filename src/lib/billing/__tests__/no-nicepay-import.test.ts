import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("billing core import graph", () => {
  it("does not import nicepay from record-payment or state-machine", async () => {
    const files = [
      path.resolve(process.cwd(), "src/lib/billing/state-machine.ts"),
      path.resolve(process.cwd(), "src/lib/billing/record-payment.ts"),
    ];

    for (const file of files) {
      const source = await fs.readFile(file, "utf8");
      expect(source.includes("src/lib/nicepay")).toBe(false);
      expect(source.includes('from "../nicepay')).toBe(false);
      expect(source.includes("from '../nicepay")).toBe(false);
      expect(source.includes("nicepay/")).toBe(false);
    }
  });
});
