import { singleton } from "tsyringe";
import { z } from "zod";

import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";

const ProviderOutagesResponseSchema = z.object({
  outages: z.array(
    z.object({
      provider: z.string(),
      hostUri: z.string(),
      startedAt: z.string().datetime(),
      lastAttemptAt: z.string().datetime()
    })
  )
});

export interface ProviderOutage {
  provider: string;
  hostUri: string;
  startedAt: string;
}

/** Every failure throws rather than resolving to an empty list, which callers cannot tell apart from every provider being healthy. */
@singleton()
export class ProviderOutagesHttpService {
  constructor(private readonly config: DeploymentConfigService) {}

  async findOutagesOlderThanDays(minAgeDays: number): Promise<ProviderOutage[]> {
    const url = new URL("/v1/provider-outages", this.config.get("PROVIDER_INVENTORY_API_URL"));
    url.searchParams.set("minAgeDays", String(minAgeDays));

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Provider inventory returned ${response.status} for ongoing outages`);
    }

    const { outages } = ProviderOutagesResponseSchema.parse(await response.json());
    const staleBefore = Date.now() - this.config.get("PROVIDER_OUTAGE_FRESHNESS_WINDOW_IN_H") * 60 * 60 * 1000;
    const stale = outages.filter(outage => new Date(outage.lastAttemptAt).getTime() < staleBefore);

    if (stale.length > 0) {
      throw new Error(
        `Provider inventory last checked ${stale.length} of ${outages.length} ongoing outages more than ` +
          `${this.config.get("PROVIDER_OUTAGE_FRESHNESS_WINDOW_IN_H")}h ago, so its record cannot be acted on`
      );
    }

    return outages.map(({ provider, hostUri, startedAt }) => ({ provider, hostUri, startedAt }));
  }
}
