import { singleton } from "tsyringe";

import { TrialProvidersService } from "@src/deployment/services/trial-providers/trial-providers.service";

@singleton()
export class ProviderController {
  constructor(private readonly trialProvidersService: TrialProvidersService) {}

  async findTrialProviders(): Promise<string[]> {
    return await this.trialProvidersService.findTrialProviders();
  }
}
