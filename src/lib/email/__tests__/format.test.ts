import { describe, expect, it } from "vitest";
import { formatKrw } from "../format";

describe("formatKrw", () => {
  it("formats 19900 with locale separators", () => {
    expect(formatKrw(19900)).toContain("19,900");
  });
});
