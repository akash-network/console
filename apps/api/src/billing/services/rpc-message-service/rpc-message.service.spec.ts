import { MsgMintACT } from "@akashnetwork/chain-sdk/private-types/akash.v1";
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

  function setup() {
    const billingConfig = mock<BillingConfigService>();
    billingConfig.get.calledWith("DEPLOYMENT_GRANT_DENOM").mockReturnValue("uact");
    const service = new RpcMessageService(billingConfig);
    return { service };
  }
});
