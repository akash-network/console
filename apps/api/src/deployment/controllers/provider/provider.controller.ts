import { singleton } from "tsyringe";

import { ProviderCleanupService } from "@src/billing/services/provider-cleanup/provider-cleanup.service";
import { ProviderCleanupParams } from "@src/billing/types/provider-cleanup";
import { TrialProvidersService } from "@src/deployment/services/trial-providers/trial-providers.service";
import { TrialProviders } from "@src/types/provider";

@singleton()
export class ProviderController {
  constructor(
    private readonly trialProvidersService: TrialProvidersService,
    private readonly providerCleanupService: ProviderCleanupService
  ) {}

  async getTrialProviders(registered: boolean): Promise<TrialProviders> {
    return await this.trialProvidersService.getTrialProviders(registered);
  }

  async cleanupProviderDeployments(options: ProviderCleanupParams) {
    return await this.providerCleanupService.cleanup(options);
  }
}
