import { singleton } from "tsyringe";

import { ProviderCleanupService } from "@src/billing/services/provider-cleanup/provider-cleanup.service";
import { ProviderCleanupParams } from "@src/billing/types/provider-cleanup";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { ProviderListQuery } from "@src/provider/http-schemas/provider.schema";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { ProviderStatsService } from "@src/provider/services/provider-stats/provider-stats.service";
import { TrialProvidersService } from "@src/provider/services/trial-providers/trial-providers.service";

const encoder = new TextEncoder();
@singleton()
export class ProviderController {
  constructor(
    private readonly trialProvidersService: TrialProvidersService,
    private readonly providerCleanupService: ProviderCleanupService,
    private readonly providerService: ProviderService,
    private readonly providerStatsService: ProviderStatsService
  ) {}

  async getTrialProviders() {
    return await this.trialProvidersService.getTrialProviders();
  }

  async cleanupProviderDeployments(options: ProviderCleanupParams) {
    return await this.providerCleanupService.cleanup(options);
  }

  async getProviderListBuffer(scope: ProviderListQuery["scope"]): Promise<any> {
    const cacheKey = scope === "trial" ? cacheKeys.getTrialProviderListJson : cacheKeys.getProviderListJson;

    return cacheResponse(60, cacheKey, async () => {
      const data = await this.providerService.getProviderList(scope === "trial");
      const json = JSON.stringify(data);
      return encoder.encode(json);
    });
  }

  async getProvider(address: string) {
    return this.providerService.getProvider(address);
  }

  async getProviderActiveLeasesGraphData(providerAddress: string) {
    return await this.providerStatsService.getProviderActiveLeasesGraphData(providerAddress);
  }
}
