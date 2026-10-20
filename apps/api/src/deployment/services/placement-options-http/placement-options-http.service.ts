import { singleton } from "tsyringe";
import { z } from "zod";

import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";

const PlacementOptionsResponseSchema = z.object({
  gpus: z.array(
    z.object({
      vendor: z.string(),
      models: z.array(z.object({ name: z.string() }))
    })
  )
});

export interface GpuModel {
  vendor: string;
  model: string;
}

@singleton()
export class PlacementOptionsHttpService {
  constructor(private readonly config: DeploymentConfigService) {}

  /** Models some online provider, audited or not, has free capacity for and would bid on with only the model pinned. */
  async findAvailableGpuModels(): Promise<GpuModel[]> {
    const url = new URL("/v1/placement-options", this.config.get("PROVIDER_INVENTORY_API_URL"));
    url.searchParams.set("includeUnaudited", "true");

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Provider inventory returned ${response.status} for placement options`);
    }

    const { gpus } = PlacementOptionsResponseSchema.parse(await response.json());

    return gpus.flatMap(({ vendor, models }) => models.map(({ name }) => ({ vendor, model: name })));
  }
}
