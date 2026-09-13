import { inject, singleton } from "tsyringe";
import { z } from "zod";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
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

type ProviderOutageRecord = z.infer<typeof ProviderOutagesResponseSchema>["outages"][number];

export interface ProviderOutage {
  provider: string;
  hostUri: string;
  startedAt: string;
}

const MAX_REPORTED_STALE_PROVIDERS = 10;

/** A failed fetch or an all-stale answer throws, so an empty list always means every provider is healthy; a partially stale answer resolves with its fresh records and warns about the skipped ones. */
@singleton()
export class ProviderOutagesHttpService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly config: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ProviderOutagesHttpService.name });
  }

  async findOutagesOlderThanDays(minAgeDays: number): Promise<ProviderOutage[]> {
    const url = new URL("/v1/provider-outages", this.config.get("PROVIDER_INVENTORY_API_URL"));
    url.searchParams.set("minAgeDays", String(minAgeDays));

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Provider inventory returned ${response.status} for ongoing outages`);
    }

    const { outages } = ProviderOutagesResponseSchema.parse(await response.json());
    const { fresh, stale } = this.partitionByFreshness(outages);
    const staleProviders = stale.map(outage => outage.provider).slice(0, MAX_REPORTED_STALE_PROVIDERS);

    if (outages.length > 0 && fresh.length === 0) {
      throw new Error(
        `Provider inventory last checked every one of ${outages.length} ongoing outages more than ` +
          `${this.freshnessWindowInHours()}h ago, so its record cannot be acted on (${staleProviders.join(", ")})`
      );
    }

    if (stale.length > 0) {
      this.logger.warn({ event: "PROVIDER_OUTAGES_STALE_SKIPPED", staleCount: stale.length, outageCount: outages.length, providers: staleProviders });
    }

    return fresh.map(({ provider, hostUri, startedAt }) => ({ provider, hostUri, startedAt }));
  }

  private partitionByFreshness(outages: ProviderOutageRecord[]) {
    const staleBefore = Date.now() - this.freshnessWindowInHours() * 60 * 60 * 1000;
    const fresh: ProviderOutageRecord[] = [];
    const stale: ProviderOutageRecord[] = [];

    for (const outage of outages) {
      (new Date(outage.lastAttemptAt).getTime() < staleBefore ? stale : fresh).push(outage);
    }

    return { fresh, stale };
  }

  private freshnessWindowInHours(): number {
    return this.config.get("PROVIDER_OUTAGE_FRESHNESS_WINDOW_IN_H");
  }
}
