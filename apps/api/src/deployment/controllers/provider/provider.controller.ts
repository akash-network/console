import { singleton } from "tsyringe";

import { TrialProvidersService } from "@src/deployment/services/trial-providers/trial-providers.service";
import { ProviderCleanupParams, ProviderCleanupService } from "@src/billing/services/provider-cleanup/provider-cleanup.service";

@singleton()
export class ProviderController {
  constructor(
    private readonly trialProvidersService: TrialProvidersService,
    private readonly providerCleanupService: ProviderCleanupService
  ) {}

  async getTrialProviders(): Promise<string[]> {
    return await this.trialProvidersService.getTrialProviders();
  }

  async cleanupProviderDeployments(options: ProviderCleanupParams) {
    return await this.providerCleanupService.cleanup(options);
  }
}
