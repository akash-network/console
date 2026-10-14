import { describe, expect, it } from "vitest";

import { deploymentCloseDedupeKeyOf } from "./dedupe-key";

describe(deploymentCloseDedupeKeyOf.name, () => {
  it("names the close of a deployment by the address that owns it and its dseq", () => {
    expect(deploymentCloseDedupeKeyOf({ owner: "akash1owner", dseq: "1234" })).toBe("deployment_close.akash1owner.1234");
  });

  it("gives the closes of different deployments of one owner different keys", () => {
    expect(deploymentCloseDedupeKeyOf({ owner: "akash1owner", dseq: "1234" })).not.toBe(deploymentCloseDedupeKeyOf({ owner: "akash1owner", dseq: "5678" }));
  });

  it("gives deployments of two owners that share a dseq different keys", () => {
    expect(deploymentCloseDedupeKeyOf({ owner: "akash1personal", dseq: "1234" })).not.toBe(deploymentCloseDedupeKeyOf({ owner: "akash1team", dseq: "1234" }));
  });
});
