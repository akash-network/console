import { describe, expect, it } from "vitest";

import { generateRandomDeploymentName } from "./generateRandomDeploymentName";

describe(generateRandomDeploymentName.name, () => {
  it("joins one adjective and one noun with a hyphen", () => {
    expect(generateRandomDeploymentName()).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it("draws every word from the lists as a lowercase word", () => {
    const names = namesAcrossTheRandomRange();

    expect(names.filter(name => !/^[a-z]+-[a-z]+$/.test(name))).toEqual([]);
  });

  it("keeps every name short enough to read at a glance", () => {
    const names = namesAcrossTheRandomRange();

    expect(Math.max(...names.map(name => name.length))).toBeLessThanOrEqual(24);
  });

  it("draws different names from different random values", () => {
    expect(generateRandomDeploymentName(() => 0)).not.toBe(generateRandomDeploymentName(() => 0.99));
  });

  it("returns the same name for the same random values", () => {
    expect(generateRandomDeploymentName(() => 0.42)).toBe(generateRandomDeploymentName(() => 0.42));
  });

  function namesAcrossTheRandomRange() {
    const steps = 1000;
    return Array.from({ length: steps }, (_, step) => generateRandomDeploymentName(() => step / steps));
  }
});
