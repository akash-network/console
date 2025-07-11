import { singleton } from "tsyringe";

import { ProviderEarningsQuery, ProviderEarningsResponse } from "@src/provider/http-schemas/provider-earnings.schema";
import { ProviderEarningsService } from "@src/provider/services/provider-earnings/provider-earnings.service";

@singleton()
export class ProviderEarningsController {
  constructor(private readonly providerEarningsService: ProviderEarningsService) {}

  async getProviderEarnings(owner: string, query: ProviderEarningsQuery): Promise<ProviderEarningsResponse> {
    return await this.providerEarningsService.getProviderEarnings(owner, query);
  }
}
