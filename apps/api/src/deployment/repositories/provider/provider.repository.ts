import { ProviderAttributeSignature } from "@akashnetwork/database/dbSchemas/akash";
import { singleton } from "tsyringe";
import { AUDITOR, TRIAL_ATTRIBUTE } from "@src/utils/constants";

@singleton()
export class ProviderRepository {
  async findTrialProviders(): Promise<string[]> {
    const trialProviders = await ProviderAttributeSignature.findAll({
      attributes: ["provider"],
      where: {
        auditor: AUDITOR,
        key: TRIAL_ATTRIBUTE,
        value: "true"
      },
      raw: true
    });

    return trialProviders ? (trialProviders.map(provider => provider.provider) as unknown as string[]) : [];
  }
}
