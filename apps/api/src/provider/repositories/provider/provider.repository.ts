import { Provider, ProviderAttributeSignature } from "@akashnetwork/database/dbSchemas/akash";
import { singleton } from "tsyringe";

import { AUDITOR, TRIAL_ATTRIBUTE } from "@src/deployment/config/provider.config";

@singleton()
export class ProviderRepository {
  async getTrialProviders(): Promise<string[]> {
    const trialProviders = await ProviderAttributeSignature.findAll({
      attributes: ["provider"],
      where: {
        auditor: AUDITOR,
        key: TRIAL_ATTRIBUTE,
        value: "true"
      },
      raw: true
    });

    return trialProviders.map(provider => provider.provider);
  }

  async getProvider(address: string): Promise<Provider> {
    return await Provider.findByPk(address);
  }
}
