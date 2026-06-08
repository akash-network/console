import { DeploymentReclamation } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { describe, expect, it } from "vitest";

import type { NewDeploymentData } from "@src/types/deployment";
import { TransactionMessageData } from "./TransactionMessageData";

describe(TransactionMessageData.name, () => {
  describe("getCreateDeploymentMsg", () => {
    it("forwards the reclamation block into the message when present", () => {
      const reclamation = DeploymentReclamation.fromPartial({ minWindow: { seconds: 86400 } });
      const deploymentData = setup({ reclamation });

      const msg = TransactionMessageData.getCreateDeploymentMsg(deploymentData);

      expect(msg.value.reclamation).toEqual(reclamation);
    });

    it("leaves reclamation unset when the deployment has none", () => {
      const deploymentData = setup({ reclamation: undefined });

      const msg = TransactionMessageData.getCreateDeploymentMsg(deploymentData);

      expect(msg.value.reclamation).toBeUndefined();
    });
  });

  function setup(input: { reclamation?: NewDeploymentData["reclamation"] }) {
    const deploymentData: NewDeploymentData = {
      sdl: {},
      manifest: {},
      groups: [],
      deploymentId: { owner: "akash1abc", dseq: "123" },
      orderId: [],
      leaseId: [],
      deposit: { denom: "uakt", amount: "1000000" },
      hash: new Uint8Array(),
      reclamation: input.reclamation
    };
    return deploymentData;
  }
});
