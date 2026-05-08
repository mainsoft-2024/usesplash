import { describe, expect, it } from "vitest";
import { mapResultCodeToError, NicepayApiError, NicepaySignatureError } from "../errors";

describe("errors", () => {
  it("maps success code", () => expect(mapResultCodeToError("0000", "ok").resultCode).toBe("0000"));
  it("maps signature style code", () => expect(mapResultCodeToError("F050", "bad sig")).toBeInstanceOf(NicepaySignatureError));
  it("maps unknown to api error", () => expect(mapResultCodeToError("9999", "x")).toBeInstanceOf(NicepayApiError));
});
