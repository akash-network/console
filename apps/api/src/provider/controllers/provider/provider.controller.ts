import { singleton } from "tsyringe";

import { ProviderCleanupService } from "@src/billing/services/provider-cleanup/provider-cleanup.service";
import { ProviderCleanupParams } from "@src/billing/types/provider-cleanup";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { ProviderListQuery } from "@src/provider/http-schemas/provider.schema";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { TrialProvidersService } from "@src/provider/services/trial-providers/trial-providers.service";

@singleton()
export class ProviderController {
  constructor(
    private readonly trialProvidersService: TrialProvidersService,
    private readonly providerCleanupService: ProviderCleanupService,
    private readonly providerService: ProviderService
  ) {}

  async getTrialProviders() {
    return await this.trialProvidersService.getTrialProviders();
  }

  async cleanupProviderDeployments(options: ProviderCleanupParams) {
    return await this.providerCleanupService.cleanup(options);
  }

  async getProviderList(scope: ProviderListQuery["scope"]) {
    return cacheResponse(
      60,
      scope === "trial" ? cacheKeys.getTrialProviderList : cacheKeys.getProviderList,
      () => this.providerService.getProviderList({ trial: scope === "trial" }),
      true
    );
  }
}
