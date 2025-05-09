import { singleton } from "tsyringe";

import { ProviderRegionsService } from "@src/provider/services/provider-regions/provider-regions.service";

@singleton()
export class ProviderRegionsController {
  constructor(private readonly providerRegionsService: ProviderRegionsService) {}

  async getProviderRegions() {
    return await this.providerRegionsService.getProviderRegions();
  }
}
