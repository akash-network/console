import { describe, expect, it } from "vitest";

import { toValidatorWebsiteUrl } from "./validatorWebsiteUrl";

describe(toValidatorWebsiteUrl.name, () => {
  it.each(["https://akash.network", "http://akash.network/validators", "HTTPS://akash.network"])("links %s as it is", website => {
    expect(toValidatorWebsiteUrl(website)).toBe(website);
  });

  it("links a bare domain over http", () => {
    expect(toValidatorWebsiteUrl("akash.network")).toBe("http://akash.network");
  });

  it("links a bare domain whose query carries another url", () => {
    expect(toValidatorWebsiteUrl("akash.network/?ref=https://example.com")).toBe("http://akash.network/?ref=https://example.com");
  });

  it("trims the surrounding whitespace", () => {
    expect(toValidatorWebsiteUrl("  https://akash.network  ")).toBe("https://akash.network");
  });

  it.each(["javascript:void(0)", "data:text/html,<p>hello</p>", "[do-not-modify]", "", "   "])("does not link %j", website => {
    expect(toValidatorWebsiteUrl(website)).toBeUndefined();
  });

  it("does not link a validator without a website", () => {
    expect(toValidatorWebsiteUrl(undefined)).toBeUndefined();
  });
});
