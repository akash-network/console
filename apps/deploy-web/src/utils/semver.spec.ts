import { describe, expect, it } from "vitest";

import { compareVersions } from "./semver";

describe(compareVersions.name, () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });

  it("returns 1 when first version is greater", () => {
    expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
  });

  it("returns -1 when first version is lesser", () => {
    expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
  });

  it("compares minor versions", () => {
    expect(compareVersions("1.2.0", "1.1.0")).toBe(1);
    expect(compareVersions("1.1.0", "1.2.0")).toBe(-1);
  });

  it("compares patch versions", () => {
    expect(compareVersions("1.0.2", "1.0.1")).toBe(1);
    expect(compareVersions("1.0.1", "1.0.2")).toBe(-1);
  });

  it("handles versions with different segment counts", () => {
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.1", "1.0")).toBe(1);
    expect(compareVersions("1.0", "1.0.1")).toBe(-1);
  });

  it("compares multi-digit segments", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareVersions("1.0.10", "1.0.9")).toBe(1);
  });
});
