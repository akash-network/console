import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto } from "@src/types/deployment";
import { getEscrowDenom } from "./deploymentUtils";

describe(getEscrowDenom.name, () => {
  it("returns the denom of the first escrow fund", () => {
    const deployment = mock<DeploymentDto>({
      escrowAccount: mock<DeploymentDto["escrowAccount"]>({
        state: mock<DeploymentDto["escrowAccount"]["state"]>({ funds: [{ denom: "uakt", amount: "1000" }] })
      })
    });

    expect(getEscrowDenom(deployment)).toBe("uakt");
  });

  it("returns an empty string when the escrow account has no funds", () => {
    const deployment = mock<DeploymentDto>({
      escrowAccount: mock<DeploymentDto["escrowAccount"]>({
        state: mock<DeploymentDto["escrowAccount"]["state"]>({ funds: [] })
      })
    });

    expect(getEscrowDenom(deployment)).toBe("");
  });
});
