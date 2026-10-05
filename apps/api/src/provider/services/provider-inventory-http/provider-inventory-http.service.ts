import { inject, singleton } from "tsyringe";
import { z } from "zod";

import { PROVIDER_CONFIG, type ProviderConfig } from "@src/provider/providers/config.provider";

const InventoryProviderSchema = z.object({
  reclamationWindow: z.number().int().positive().nullable()
});

/** Keeps a slow inventory from holding up the provider page, which waits on this read. */
const INVENTORY_TIMEOUT_MS = 3000;

@singleton()
export class ProviderInventoryHttpService {
  constructor(@inject(PROVIDER_CONFIG) private readonly config: ProviderConfig) {}

  /** Null when the provider reports no reclamation window or the inventory has no record of it. */
  async findReclamationWindow(owner: string): Promise<number | null> {
    const url = new URL(`/v1/providers/${encodeURIComponent(owner)}`, this.config.PROVIDER_INVENTORY_API_URL);
    const response = await fetch(url, { signal: AbortSignal.timeout(INVENTORY_TIMEOUT_MS) });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Provider inventory returned ${response.status} for provider ${owner}`);
    }

    return InventoryProviderSchema.parse(await response.json()).reclamationWindow;
  }
}
