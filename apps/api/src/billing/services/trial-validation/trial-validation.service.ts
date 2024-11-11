import * as v1beta3 from "@akashnetwork/akash-api/v1beta3";
import { EncodeObject } from "@cosmjs/proto-signing";
import { singleton } from "tsyringe";

import { UserWalletOutput } from "@src/billing/repositories";

const TRIAL_ATTRIBUTE = "console/trials";
const AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

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

        if (!hasTrial || !hasSignedByAllOf) {
          throw new Error(`provider not authorized: ${group.requirements.attributes}`);
        }
      });
    }

    return true;
  }
}
