import { singleton } from "tsyringe";

import { ProviderRepository } from "@src/deployment/repositories/provider/provider.repository";

@singleton()
export class TrialProvidersService {
  constructor(private readonly providerRepository: ProviderRepository) {}

  async findTrialProviders(): Promise<string[]> {
    return await this.providerRepository.findTrialProviders();
  }
}
