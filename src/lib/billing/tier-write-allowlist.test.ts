import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(process.cwd(), "src");
const ALLOWLIST = new Set([
  path.normalize("src/lib/billing/record-payment.ts"),
  path.normalize("src/server/routers/subscription.ts"),
  path.normalize("src/app/api/cron/billing/route.ts"),
  path.normalize("src/app/api/payments/nicepay/return/route.ts"),
  path.normalize("src/app/api/webhooks/nicepay/route.ts"),
]);

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      if (!entry.isFile()) return [];
      if (!/\.(ts|tsx)$/.test(entry.name)) return [];
      return [full];
    }),
  );
  return nested.flat();
}

describe("Subscription.tier writer allowlist", () => {
  it("blocks tier write locations outside allowlist", async () => {
    const files = await walk(ROOT);
    const offenders: Array<{ file: string; matches: string[] }> = [];

    for (const file of files) {
      const rel = path.normalize(path.relative(process.cwd(), file));
      const source = await fs.readFile(file, "utf8");

      const assignmentMatches = [...source.matchAll(/subscription\.tier\s*=\s*/g)].map((m) => m[0]);
      const directUpdateMatches = [...source.matchAll(/subscription\.update\(\s*\{[\s\S]{0,800}?\bdata\s*:\s*\{[\s\S]{0,400}?\btier\s*:/g)].map((m) => m[0]);
      const nestedUpdateMatches = [...source.matchAll(/subscription\s*:\s*\{[\s\S]{0,200}?\b(?:update|upsert|create)\s*:\s*\{[\s\S]{0,400}?\btier\s*:/g)].map((m) => m[0]);
      const matches = [...assignmentMatches, ...directUpdateMatches, ...nestedUpdateMatches];

      if (matches.length > 0 && !ALLOWLIST.has(rel)) {
        offenders.push({ file: rel, matches });
      }
    }

    const message = offenders
      .map((offender) => `- ${offender.file}\n${offender.matches.map((m) => `    ${m.slice(0, 140)}`).join("\n")}`)
      .join("\n\n");

    expect(offenders, `Unexpected tier write(s) outside allowlist:\n${message}`).toEqual([]);
  });
});
