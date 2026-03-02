import { describe, expect, it } from "vitest";

import { UrlService } from "./urlUtils";

describe("UrlService.billing", () => {
  it("returns /billing with no params by default", () => {
    expect(UrlService.billing()).toBe("/billing");
  });

  it("returns /billing with openPayment query param when specified", () => {
    expect(UrlService.billing({ openPayment: true })).toBe("/billing?openPayment=true");
  });

  it("returns /billing without query param when openPayment is false", () => {
    expect(UrlService.billing({ openPayment: false })).toBe("/billing");
  });
});
