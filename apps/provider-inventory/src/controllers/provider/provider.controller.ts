import createError from "http-errors";
import { singleton } from "tsyringe";

import type { ProviderResponse } from "@src/http-schemas/provider.schema";
import { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";

@singleton()
export class ProviderController {
  readonly #providerInventoryRepository: ProviderInventoryRepository;

  constructor(providerInventoryRepository: ProviderInventoryRepository) {
    this.#providerInventoryRepository = providerInventoryRepository;
  }

  async getProvider(owner: string): Promise<ProviderResponse> {
    const provider = await this.#providerInventoryRepository.findByOwner(owner);

    if (!provider) {
      throw createError(404, `Provider ${owner} is not in the inventory`);
    }

    return provider;
  }
}
