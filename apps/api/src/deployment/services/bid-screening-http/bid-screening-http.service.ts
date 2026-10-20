import { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { singleton } from "tsyringe";
import { z } from "zod";

import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";

const BidScreeningResponseSchema = z.object({
  providers: z.array(z.object({ owner: z.string() }))
});

const SCREENING_TIMEOUT_MS = 30_000;

@singleton()
export class BidScreeningHttpService {
  constructor(private readonly config: DeploymentConfigService) {}

  /** Owners of the providers bid screening expects could host the group, audited or not. */
  async findScreenedProviders(groupSpec: GroupSpec): Promise<string[]> {
    const url = new URL("/v1/bid-screening", this.config.get("PROVIDER_INVENTORY_API_URL"));
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(GroupSpec.toJSON(groupSpec) as object), timezone: "UTC" }),
      signal: AbortSignal.timeout(SCREENING_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`Provider inventory returned ${response.status} for bid screening`);
    }

    return BidScreeningResponseSchema.parse(await response.json()).providers.map(({ owner }) => owner);
  }
}
