import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { AlertConfig } from "@src/modules/alert/config";
import { type ProviderTierDemotionFeed, ProviderTierDemotionFeedSchema } from "@src/modules/alert/types/provider-tier-demotion.type";

@Injectable()
export class ProviderTierDemotionFeedService {
  constructor(private readonly configService: ConfigService<AlertConfig>) {}

  async get(after: string, signal?: AbortSignal): Promise<ProviderTierDemotionFeed> {
    const endpoint = new URL("/internal/v1/provider-verification/tier-demotions", this.configService.getOrThrow("alert.CONSOLE_API_ENDPOINT"));
    endpoint.searchParams.set("after", after);
    endpoint.searchParams.set("limit", String(this.configService.getOrThrow("alert.PROVIDER_TIER_DEMOTION_PAGE_SIZE")));

    const token = this.configService.get("alert.CONSOLE_API_SECRET_TOKEN");
    if (token) endpoint.searchParams.set("token", token);

    const response = await fetch(endpoint, {
      headers: { accept: "application/json" },
      signal
    });

    if (!response.ok) {
      throw new Error(`Provider tier-demotion feed returned HTTP ${response.status}`);
    }

    return ProviderTierDemotionFeedSchema.parse(await response.json());
  }
}
