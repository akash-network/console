import { MsgCreateDeployment } from "@akashnetwork/akash-api/v1beta4";
import { EncodeObject } from "@cosmjs/proto-signing";
import { singleton } from "tsyringe";

import { UserWalletOutput } from "@src/billing/repositories";
import { AUDITOR, TRIAL_ATTRIBUTE } from "@src/deployment/config/provider.config";

@singleton()
export class TrialValidationService {
  async validateLeaseProviders(decoded: EncodeObject, userWallet: UserWalletOutput) {
    if (userWallet.isTrialing && decoded.typeUrl === "/akash.deployment.v1beta4.MsgCreateDeployment") {
      const value = decoded.value as MsgCreateDeployment;

      value.groups.forEach(group => {
        const hasTrial = group.requirements.attributes.some(attribute => {
          return attribute.key === TRIAL_ATTRIBUTE && attribute.value === "true";
        });

        const hasSignedByAllOf = group.requirements.signedBy.allOf.every(signedBy => {
          return signedBy === AUDITOR;
        });

        if (!hasTrial || !hasSignedByAllOf) {
          throw new Error(`provider not authorized: ${group.requirements.attributes}`);
        }
      });
    }

    return true;
  }
}
