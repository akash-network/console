import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateCommissionService } from "./affiliate-commission.service";
import { SyncAffiliateCommissionHandler } from "./sync-affiliate-commission.handler";
import { SyncAffiliateCommission } from "./sync-affiliate-commission.job";

describe(SyncAffiliateCommissionHandler.name, () => {
  it("accepts the affiliate commission sync job", () => {
    const { handler } = setup();

    expect(handler.accepts).toBe(SyncAffiliateCommission);
  });

  it("needs no permission because the sync reads and writes through unscoped repositories", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  it("syncs the commission of the payment named by the job", async () => {
    const { handler, affiliateCommissionService } = setup();

    await handler.handle({ transactionId: "payment-transaction-id", version: 1 });

    expect(affiliateCommissionService.syncCommission).toHaveBeenCalledWith("payment-transaction-id");
  });

  function setup() {
    const affiliateCommissionService = mock<AffiliateCommissionService>();
    const handler = new SyncAffiliateCommissionHandler(affiliateCommissionService);

    return { handler, affiliateCommissionService };
  }
});
