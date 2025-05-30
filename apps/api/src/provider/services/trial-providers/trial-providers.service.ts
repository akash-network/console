import { singleton } from "tsyringe";

import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";

@singleton()
export class TrialProvidersService {
  constructor(private readonly providerRepository: ProviderRepository) {}

  async getTrialProviders(): Promise<string[]> {
    return await this.providerRepository.getTrialProviders();
  }
}
