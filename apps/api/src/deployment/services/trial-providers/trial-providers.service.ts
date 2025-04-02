import { singleton } from "tsyringe";

import { ProviderRepository } from "@src/deployment/repositories/provider/provider.repository";
import { TrialProviders } from "@src/types/provider";

@singleton()
export class TrialProvidersService {
  constructor(private readonly providerRepository: ProviderRepository) {}

  async getTrialProviders(registered: boolean): Promise<TrialProviders> {
    return await this.providerRepository.getTrialProviders(registered);
  }
}
