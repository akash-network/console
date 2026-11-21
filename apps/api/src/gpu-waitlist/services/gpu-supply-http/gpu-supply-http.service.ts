import { singleton } from "tsyringe";
import { z } from "zod";

import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";

const GpuSupplyResponseSchema = z.object({
  data: z.array(
    z.object({
      owner: z.string(),
      node: z.number().int(),
      vendor: z.string(),
      model: z.string(),
      memory: z.string(),
      interface: z.string(),
      units: z.number().int(),
      nodeFreeUnits: z.number().int().nullable()
    })
  )
});

const SUPPLY_REQUEST_TIMEOUT_MS = 10_000;

export type GpuSupplyRow = z.infer<typeof GpuSupplyResponseSchema>["data"][number];

@singleton()
export class GpuSupplyHttpService {
  constructor(private readonly config: DeploymentConfigService) {}

  async findSupply({ vendor, model }: { vendor: string; model: string }): Promise<GpuSupplyRow[]> {
    const url = new URL("/v1/gpu-supply", this.config.get("PROVIDER_INVENTORY_API_URL"));
    url.searchParams.set("vendor", vendor);
    url.searchParams.set("model", model);

    const response = await fetch(url, { signal: AbortSignal.timeout(SUPPLY_REQUEST_TIMEOUT_MS) });

    if (!response.ok) {
      throw new Error(`Provider inventory returned ${response.status} for ${vendor} ${model} supply`);
    }

    return GpuSupplyResponseSchema.parse(await response.json()).data;
  }
}
