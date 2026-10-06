import type { LoggerService } from "@akashnetwork/logging";
import { z } from "zod";

/** A proxied request reaches this lookup only after its chain lookup failed, so it must not hold the request much longer. */
const HOST_URI_LOOKUP_TIMEOUT_MS = 3_000;

const InventoryProviderSchema = z.object({
  hostUri: z.string()
});

export class ProviderInventoryService {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #logger?: LoggerService;

  constructor(baseUrl: string, fetchFn: typeof fetch, logger?: LoggerService) {
    this.#baseUrl = baseUrl;
    this.#fetch = fetchFn;
    this.#logger = logger;
  }

  /** Resolves `null` when the inventory has no such provider and rejects when the inventory cannot be queried. */
  async getHostUri(providerAddress: string): Promise<string | null> {
    try {
      const url = new URL(`/v1/providers/${encodeURIComponent(providerAddress)}`, this.#baseUrl);
      const response = await this.#fetch(url, { signal: AbortSignal.timeout(HOST_URI_LOOKUP_TIMEOUT_MS) });

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Provider inventory responded with ${response.status}`);

      return InventoryProviderSchema.parse(await response.json()).hostUri;
    } catch (error) {
      this.#logger?.error({
        event: "PROVIDER_INVENTORY_HOST_FETCH_ERROR",
        providerAddress,
        error
      });
      throw error;
    }
  }
}
