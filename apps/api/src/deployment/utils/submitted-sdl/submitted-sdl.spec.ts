import { describe, expect, it } from "vitest";

import { submittedSdlOf } from "./submitted-sdl";

describe(submittedSdlOf.name, () => {
  it("answers the sdl text as it was sent", () => {
    expect(submittedSdlOf({ sdl: "version: '2.0'\n" })).toBe("version: '2.0'\n");
  });

  it("answers a definition as compact JSON with its keys in the order sent", () => {
    expect(submittedSdlOf({ definition: { version: "2.0", services: { web: { image: "nginx" } } } })).toBe(
      '{"version":"2.0","services":{"web":{"image":"nginx"}}}'
    );
  });
});
