import * as v1beta3 from "@akashnetwork/akash-api/v1beta3";
import { EncodeObject } from "@cosmjs/proto-signing";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { UserWalletOutput } from "@src/billing/repositories";
import { AUDITOR, TRIAL_ATTRIBUTE } from "@src/deployment/config/provider.config";
import { getAddressDeployments } from "@src/services/external/apiNodeService";

const TRIAL_DEPLOYMENT_LIMIT = 5;

@singleton()
export class TrialValidationService {
  async validateLeaseProviders(decoded: EncodeObject, userWallet: UserWalletOutput) {
    if (userWallet.isTrialing && decoded.typeUrl === "/akash.deployment.v1beta3.MsgCreateDeployment") {
      const value = decoded.value as v1beta3.MsgCreateDeployment;

      value.groups.forEach(group => {
        const hasTrial = group.requirements.attributes.some(attribute => {
          return attribute.key === TRIAL_ATTRIBUTE && attribute.value === "true";
        });

        const hasSignedByAllOf = group.requirements.signedBy.allOf.every(signedBy => {
          return signedBy === AUDITOR;
        });
        assert(hasTrial && hasSignedByAllOf, 400, `provider not authorized: ${group.requirements.attributes}`);
      });
    }

    return true;
  }

  async validateTrialLimit(decoded: EncodeObject, userWallet: UserWalletOutput) {
    if (userWallet.isTrialing && decoded.typeUrl === "/akash.deployment.v1beta3.MsgCreateDeployment") {
      const deployments = await getAddressDeployments(userWallet.address, 0, 1, false, {});
      assert(deployments.count < TRIAL_DEPLOYMENT_LIMIT, 402, "Trial limit reached. Add funds to your account to deploy more.");
    }
  }
}
