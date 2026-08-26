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

/**
 * Reads the provider inventory's record of who is currently unreachable — the only place that knows,
 * since it is what holds the streams to every provider.
 *
 * Every failure throws rather than resolving to an empty list. Callers use this to decide whether to
 * warn a user or close their deployment, and an empty list is indistinguishable from "everyone is
 * healthy": swallowing an error here would turn an inventory outage into silence, and a stale record
 * into a wrong close. An outage the inventory has not re-checked within the freshness window means the
 * inventory itself has stopped observing, so the whole answer is refused rather than half-trusted.
 */
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
