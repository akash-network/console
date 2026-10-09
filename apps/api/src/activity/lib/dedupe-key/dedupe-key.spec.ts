import { describe, expect, it } from "vitest";

import { deploymentCloseDedupeKeyOf } from "./dedupe-key";

describe(deploymentCloseDedupeKeyOf.name, () => {
  it("names the close of a deployment by its dseq, in the form the migration gave existing rows", () => {
    expect(deploymentCloseDedupeKeyOf("1234")).toBe("deployment_close.1234");
  });

  it("gives the closes of different deployments different keys", () => {
    expect(deploymentCloseDedupeKeyOf("1234")).not.toBe(deploymentCloseDedupeKeyOf("5678"));
  });
});
