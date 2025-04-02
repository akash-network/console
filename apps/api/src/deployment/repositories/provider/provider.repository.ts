import { Provider, ProviderAttributeSignature, ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import { singleton } from "tsyringe";

import { AUDITOR, TRIAL_ATTRIBUTE, TRIAL_REGISTERED_ATTRIBUTE } from "@src/deployment/config/provider.config";
import { TrialProviders } from "@src/types/provider";

@singleton()
export class ProviderRepository {
  async getTrialProviders(registered: boolean): Promise<TrialProviders> {
    const providers = await Provider.findAll({
      attributes: ["owner", "hostUri"],
      include: [
        {
          model: ProviderSnapshot,
          as: "lastSuccessfulSnapshot",
          required: true,
          attributes: ["availableCPU", "availableGPU", "availableMemory", "availablePersistentStorage", "availableEphemeralStorage", "checkDate"]
        },
        {
          model: ProviderAttributeSignature,
          required: true,
          where: {
            auditor: AUDITOR,
            key: registered ? TRIAL_REGISTERED_ATTRIBUTE : TRIAL_ATTRIBUTE,
            value: "true"
          }
        }
      ],
      order: ["owner"]
    });

    const mappedProviders = providers.map(provider => ({
      owner: provider.owner,
      hostUri: provider.hostUri,
      availableCPU: provider.lastSuccessfulSnapshot?.availableCPU || 0,
      availableGPU: provider.lastSuccessfulSnapshot?.availableGPU || 0,
      availableMemory: provider.lastSuccessfulSnapshot?.availableMemory || 0,
      availablePersistentStorage: provider.lastSuccessfulSnapshot?.availablePersistentStorage || 0,
      availableEphemeralStorage: provider.lastSuccessfulSnapshot?.availableEphemeralStorage || 0
    }));

    const total = mappedProviders.reduce(
      (acc, provider) => ({
        availableCPU: acc.availableCPU + provider.availableCPU,
        availableGPU: acc.availableGPU + provider.availableGPU,
        availableMemory: acc.availableMemory + provider.availableMemory,
        availablePersistentStorage: acc.availablePersistentStorage + provider.availablePersistentStorage,
        availableEphemeralStorage: acc.availableEphemeralStorage + provider.availableEphemeralStorage
      }),
      {
        availableCPU: 0,
        availableGPU: 0,
        availableMemory: 0,
        availablePersistentStorage: 0,
        availableEphemeralStorage: 0
      }
    );

    return {
      providers: mappedProviders,
      total
    };
  }

  async getProvider(address: string): Promise<Provider> {
    return await Provider.findByPk(address);
  }
}
