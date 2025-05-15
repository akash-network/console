import { singleton } from "tsyringe";

import { ProviderVersionsResponse } from "@src/provider/http-schemas/provider-versions.schema";
import { ProviderVersionsService } from "@src/provider/services/provider-versions/provider-versions.service";

@singleton()
export class ProviderVersionsController {
  constructor(private readonly providerVersionsService: ProviderVersionsService) {}

  async getProviderVersions(): Promise<ProviderVersionsResponse> {
    return await this.providerVersionsService.getProviderVersions();
  }
}
