import { DeploymentReclamation, MsgMintACT } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { mock } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { RpcMessageService } from "./rpc-message.service";

describe(RpcMessageService.name, () => {
  describe("getMintACTMsg", () => {
    it("should construct a MsgMintACT message with correct fields", () => {
      const { service } = setup();

      const msg = service.getMintACTMsg({ owner: "akash1abc", amount: 1000000 });

      expect(msg).toEqual({
        typeUrl: `/${MsgMintACT.$type}`,
        value: MsgMintACT.fromPartial({
          owner: "akash1abc",
          to: "akash1abc",
          coinsToBurn: {
            denom: "uakt",
            amount: "1000000"
          }
        })
      });
    });
  });

  describe("getCreateDeploymentMsg", () => {
    const baseOptions = {
      owner: "akash1abc",
      dseq: 123,
      groups: [],
      hash: new Uint8Array(),
      denom: "uakt",
      amount: 1000000
    };

    it("forwards the reclamation block into the message when the SDL declares it", () => {
      const { service } = setup();
      const reclamation = DeploymentReclamation.fromPartial({ minWindow: { seconds: 86400 } });

      const msg = service.getCreateDeploymentMsg({ ...baseOptions, reclamation });

      expect(msg.value.reclamation).toEqual(reclamation);
    });

    it("leaves reclamation unset for an SDL without a reclamation block", () => {
      const { service } = setup();

      const msg = service.getCreateDeploymentMsg(baseOptions);

      expect(msg.value.reclamation).toBeUndefined();
    });
  });

  function setup() {
    const billingConfig = mock<BillingConfigService>();
    billingConfig.get.calledWith("DEPLOYMENT_GRANT_DENOM").mockReturnValue("uact");
    const service = new RpcMessageService(billingConfig);
    return { service };
  }
});
