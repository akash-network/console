import { singleton } from "tsyringe";

import { PricingBody, PricingResponse } from "@src/pricing/http-schemas/pricing.schema";
import { PricingService } from "@src/pricing/services/pricing/pricing.service";

@singleton()
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  async getPricing(specs: PricingBody): Promise<PricingResponse> {
    return this.pricingService.getPricing(specs);
  }
}
