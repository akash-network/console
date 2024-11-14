import * as v1beta4 from "@akashnetwork/akash-api/v1beta4";
import { EncodeObject } from "@cosmjs/proto-signing";
import { singleton } from "tsyringe";

import { UserWalletOutput } from "@src/billing/repositories";
import { getTrialProviders } from "@src/services/external/githubService";

@singleton()
export class TrialValidationService {
  async validateLeaseProviders(decoded: EncodeObject, userWallet: UserWalletOutput) {
    if (userWallet.isTrialing && decoded.typeUrl === "/akash.market.v1beta4.MsgCreateLease") {
      const authorizedProviders = await getTrialProviders();
      const value = decoded.value as v1beta4.MsgCreateLease;

      if (!authorizedProviders.includes(value.bidId.provider)) {
        throw new Error(`provider not authorized: ${value.bidId.provider}`);
      }
    }

    return true;
  }
}
