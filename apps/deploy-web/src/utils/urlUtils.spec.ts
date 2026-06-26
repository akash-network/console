import { describe, expect, it } from "vitest";

import { UrlService } from "./urlUtils";

describe(UrlService.billing.name, () => {
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

describe(UrlService.configureDeployment.name, () => {
  it("builds the base configure path with strategy params", () => {
    expect(UrlService.configureDeployment({ templateId: "abc", sdlStrategy: "default", bidStrategy: "auto" })).toBe(
      "/new-deployment/configure?templateId=abc&sdl-strategy=default&bid-strategy=auto"
    );
  });

  it("puts dseq in the path once present", () => {
    expect(UrlService.configureDeployment({ dseq: "12345", bidStrategy: "auto" })).toBe("/new-deployment/configure/12345?bid-strategy=auto");
  });

  it("omits absent params", () => {
    expect(UrlService.configureDeployment({})).toBe("/new-deployment/configure");
  });

  it("includes the draft id when present", () => {
    expect(UrlService.configureDeployment({ draftId: "draft-1", bidStrategy: "select" })).toBe(
      "/new-deployment/configure?bid-strategy=select&draftId=draft-1"
    );
  });

  it("keeps the draft id alongside the dseq path segment", () => {
    expect(UrlService.configureDeployment({ dseq: "12345", draftId: "draft-1" })).toBe("/new-deployment/configure/12345?draftId=draft-1");
  });
});
