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
});
