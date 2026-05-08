import { describe, expect, it } from "vitest";
import { getBasicAuthHeader } from "../auth";

describe("auth", () => {
  it("creates basic auth header", () => {
    expect(getBasicAuthHeader("id", "secret")).toBe(`Basic ${Buffer.from("id:secret").toString("base64")}`);
  });
});
