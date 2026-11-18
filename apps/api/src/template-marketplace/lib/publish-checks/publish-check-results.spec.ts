import { describe, expect, it } from "vitest";

import { hasPassedPublishChecks, toPublishCheck } from "./publish-check-results";

describe(toPublishCheck.name, () => {
  it("passes a check that found no issue", () => {
    expect(toPublishCheck("sdl_valid", [])).toEqual({ key: "sdl_valid", status: "passed", issues: [] });
  });

  it("fails a check with the issues it found", () => {
    const issues = [{ message: "Pin the tag", service: "web", image: "nginx" }];

    expect(toPublishCheck("fixed_tags", issues)).toEqual({ key: "fixed_tags", status: "failed", issues });
  });
});

describe(hasPassedPublishChecks.name, () => {
  it("answers true when every check passed", () => {
    expect(hasPassedPublishChecks({ checks: [toPublishCheck("sdl_valid", []), toPublishCheck("fixed_tags", [])] })).toBe(true);
  });

  it("answers false once one check failed", () => {
    expect(hasPassedPublishChecks({ checks: [toPublishCheck("sdl_valid", []), toPublishCheck("fixed_tags", [{ message: "Pin the tag" }])] })).toBe(false);
  });
});
