import type { AxiosInstance } from "axios";
import DataLoader from "dataloader";

import type { ApiProviderList } from "@src/types/provider";

/** The console API refuses a provider list asked for by more addresses than this. */
export const MAX_ADDRESSES_PER_REQUEST = 20;

/** Joins the address lookups made within one tick into as few provider list requests as the console API allows. */
export class ProviderLookupService {
  readonly #loader: DataLoader<string, ApiProviderList | null>;

  constructor(
    private readonly httpClient: AxiosInstance,
    private readonly getBaseApiUrl: () => string
  ) {
    this.#loader = new DataLoader(addresses => this.#fetchByAddresses(addresses), { maxBatchSize: MAX_ADDRESSES_PER_REQUEST, cache: false });
  }

  findByAddress(address: string): Promise<ApiProviderList | null> {
    return this.#loader.load(address);
  }

  async #fetchByAddresses(addresses: readonly string[]): Promise<Array<ApiProviderList | null>> {
    const { data: providers } = await this.httpClient.get<ApiProviderList[]>(`${this.getBaseApiUrl()}/v1/providers`, {
      params: { addresses: [...new Set(addresses)].join(",") }
    });
    const providersByAddress = new Map(providers.map(provider => [provider.owner, provider]));

    return addresses.map(address => providersByAddress.get(address) ?? null);
  }
}
