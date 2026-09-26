import type { CheckResult, ParityCheck } from "@src/parity/report";
import type { ReconcileService } from "@src/reconcile/reconcile.service";

/** The chain itself is the reference for balances, so this check reuses the reconcile service instead of the legacy database. */
export class BalancesCheck implements ParityCheck {
  readonly name = "balances";
  readonly #reconcile: Pick<ReconcileService, "reconcile">;
  readonly #sampleSize: number | undefined;

  constructor(reconcile: Pick<ReconcileService, "reconcile">, sampleSize?: number) {
    this.#reconcile = reconcile;
    this.#sampleSize = sampleSize;
  }

  async run(): Promise<CheckResult> {
    const ok = await this.#reconcile.reconcile(this.#sampleSize === undefined ? {} : { sampleSize: this.#sampleSize });
    return {
      name: this.name,
      status: ok ? "pass" : "fail",
      summary: ok
        ? "sampled balances and total supply match the chain at the sync checkpoint"
        : "ledger differs from the chain, see the RECONCILE_* log events",
      mismatches: []
    };
  }
}
