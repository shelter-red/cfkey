import { describe, expect, it } from "vitest";
import {
  base64UrlToBytes,
  base64UrlToText,
  bytesToBase64Url,
  textToBase64Url,
} from "../src/shared/base64-url";

describe("base64 URL helpers", () => {
  it("round trips binary values without padding", () => {
    const encoded = bytesToBase64Url(Uint8Array.from([0, 1, 127, 128, 255]));
    expect(encoded).not.toMatch(/[+/=]/);
    expect(base64UrlToBytes(encoded)).toEqual(Uint8Array.from([0, 1, 127, 128, 255]));
  });

  it("round trips Unicode text", () => {
    const value = "CFKey 数据库凭据";
    expect(base64UrlToText(textToBase64Url(value))).toBe(value);
  });
});
