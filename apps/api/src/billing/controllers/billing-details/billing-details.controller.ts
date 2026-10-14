import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { BillingDetailsResponse, UpdateBillingDetailsRequest } from "@src/billing/http-schemas/billing-details.schema";
import { BillingDetailsService } from "@src/billing/services/billing-details/billing-details.service";
import { PayerService } from "@src/billing/services/payer/payer.service";

@singleton()
export class BillingDetailsController {
  constructor(
    private readonly payerService: PayerService,
    private readonly billingDetailsService: BillingDetailsService
  ) {}

  @Protected([{ action: "read", subject: "PaymentMethod" }])
  async getBillingDetails(): Promise<BillingDetailsResponse> {
    const payer = await this.payerService.getCurrentPayer();

    return { data: await this.billingDetailsService.getBillingDetails(payer) };
  }

  @Protected([{ action: "update", subject: "PaymentMethod" }])
  async updateBillingDetails(input: UpdateBillingDetailsRequest): Promise<BillingDetailsResponse> {
    const payer = await this.payerService.getCurrentPayer();

    return { data: await this.billingDetailsService.updateBillingDetails(payer, input.data) };
  }
}
