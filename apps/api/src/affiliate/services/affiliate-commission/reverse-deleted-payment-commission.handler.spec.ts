import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateCommissionService } from "./affiliate-commission.service";
import { ReverseDeletedPaymentCommissionHandler } from "./reverse-deleted-payment-commission.handler";
import { type DeletedPaymentReversal, ReverseDeletedPaymentCommission } from "./reverse-deleted-payment-commission.job";

describe(ReverseDeletedPaymentCommissionHandler.name, () => {
  it("accepts the job that reverses the commission of a deleted payment", () => {
    const { handler } = setup();

    expect(handler.accepts).toBe(ReverseDeletedPaymentCommission);
  });

  it("needs no permission because the reversal reads and writes through unscoped repositories", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  it.each<DeletedPaymentReversal>([{ reason: "refund", amount: 10000, amountRefunded: 4000 }, { reason: "dispute_lost" }])(
    "reverses the commissions earned on the charge named by the job for %o",
    async reversal => {
      const { handler, affiliateCommissionService } = setup();

      await handler.handle({ stripeChargeId: "ch_deleted_payment", reversal, version: 1 });

      expect(affiliateCommissionService.reverseCommissionsOfDeletedPayment).toHaveBeenCalledWith("ch_deleted_payment", reversal);
    }
  );

  function setup() {
    const affiliateCommissionService = mock<AffiliateCommissionService>();
    const handler = new ReverseDeletedPaymentCommissionHandler(affiliateCommissionService);

    return { handler, affiliateCommissionService };
  }
});
