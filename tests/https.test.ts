import { describe, expect, it } from "vitest";
import { httpsLocation } from "../src/shared/https";

describe("HTTPS enforcement", () => {
  it("preserves the URL while switching HTTP to HTTPS", () => {
    const location = {
      protocol: "http:",
      href: "http://cfkey.test/items?q=one#detail",
    };

    expect(httpsLocation(location)).toBe("https://cfkey.test/items?q=one#detail");
  });

  it("does not redirect an HTTPS location", () => {
    const location = {
      protocol: "https:",
      href: "https://cfkey.test/",
    };

    expect(httpsLocation(location)).toBeNull();
  });
});
