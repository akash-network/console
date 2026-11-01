import { describe, expect, it } from "vitest";

import { UrlReturnToStack } from "./UrlReturnToStack";

describe(UrlReturnToStack.name, () => {
  it("stacks returnTo and can be popped like a stack", () => {
    const origin = "http://localhost:3000";

    const second = UrlReturnToStack.createReturnable(`${origin}/first?firstParam=firstValue`, "/second?secondParam=secondValue");

    const third = UrlReturnToStack.createReturnable(`${origin}${second}`, "/third?thirdParam=thirdValue", {
      extraQueryParams: { fromSecond: "true" }
    });

    const poppedFromThird = UrlReturnToStack.getReturnTo(`${origin}${third}`);
    expect(poppedFromThird).toBe("/second?secondParam=secondValue&fromSecond=true&returnTo=%2Ffirst%3FfirstParam%3DfirstValue");

    const poppedFromSecond = UrlReturnToStack.getReturnTo(`${origin}${poppedFromThird}`);
    expect(poppedFromSecond).toBe("/first?firstParam=firstValue");
  });

  it.each([
    "returnTo=%2F%09%2Fevil.example",
    "returnTo=%2F%2509%2Fevil.example",
    "returnTo=%2F%0A%2Fevil.example",
    "returnTo=%2F%0D%2Fevil.example",
    "from=%2F%09%2Fevil.example",
    "returnTo=%2F%5Cevil.example",
    "returnTo=%2F.%2F%2Fevil.example",
    `returnTo=${encodeURIComponent(`${window.location.origin}//evil.example/x`)}`
  ])("pops %s to the home page", query => {
    expect(UrlReturnToStack.getReturnTo(`/login?${query}`)).toBe("/");
  });

  it("pops a same-origin absolute returnTo to its path and query", () => {
    const returnTo = encodeURIComponent(`${window.location.origin}/deployments?tab=active`);

    expect(UrlReturnToStack.getReturnTo(`/login?returnTo=${returnTo}`)).toBe("/deployments?tab=active");
  });
});
