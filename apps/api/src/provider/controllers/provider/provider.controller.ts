import { singleton } from "tsyringe";

import { ProviderCleanupService } from "@src/billing/services/provider-cleanup/provider-cleanup.service";
import { ProviderCleanupParams } from "@src/billing/types/provider-cleanup";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { ProviderListQuery, ProviderListResponse } from "@src/provider/http-schemas/provider.schema";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { ProviderStatsService } from "@src/provider/services/provider-stats/provider-stats.service";
import { TrialProvidersService } from "@src/provider/services/trial-providers/trial-providers.service";

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

  async getProviderList(scope: ProviderListQuery["scope"]): Promise<ProviderListResponse> {
    return cacheResponse(60, scope === "trial" ? cacheKeys.getTrialProviderList : cacheKeys.getProviderList, () =>
      this.providerService.getProviderList(scope === "trial")
    ) as unknown as Promise<ProviderListResponse>;
  }

  async getProviderListJson(scope: ProviderListQuery["scope"]): Promise<string> {
    const jsonCacheKey = scope === "trial" ? cacheKeys.getTrialProviderListJson : cacheKeys.getProviderListJson;

    return cacheResponse(60, jsonCacheKey, async () => {
      const data = await this.getProviderList(scope);
      return JSON.stringify(data);
    });
  }

  async getProvider(address: string) {
    return this.providerService.getProvider(address);
  }

  async getProviderActiveLeasesGraphData(providerAddress: string) {
    return await this.providerStatsService.getProviderActiveLeasesGraphData(providerAddress);
  }
}
