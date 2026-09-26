import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { BalancesCheck } from "@src/parity/checks/balances.check";
import type { ReconcileService } from "@src/reconcile/reconcile.service";

describe(BalancesCheck.name, () => {
  it("passes when the ledger matches the chain at the sync checkpoint", async () => {
    const { check } = setup({ ok: true });

    const result = await check.run();

    expect(result).toEqual({
      name: "balances",
      status: "pass",
      summary: "sampled balances and total supply match the chain at the sync checkpoint",
      mismatches: []
    });
  });

  it("fails and points at the reconcile log events when the ledger differs", async () => {
    const { check } = setup({ ok: false });

    const result = await check.run();

    expect(result.status).toBe("fail");
    expect(result.summary).toContain("RECONCILE_");
  });

  it("forwards the configured sample size", async () => {
    const { check, reconcile } = setup({ ok: true, sampleSize: 7 });

    await check.run();

    expect(reconcile.reconcile).toHaveBeenCalledWith({ sampleSize: 7 });
  });

  function setup(input: { ok: boolean; sampleSize?: number }) {
    const reconcile = mock<ReconcileService>();
    reconcile.reconcile.mockResolvedValue(input.ok);
    const check = new BalancesCheck(reconcile, input.sampleSize);
    return { check, reconcile };
  }
});
