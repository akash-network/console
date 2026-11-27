import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import type { HealthzResponse } from "@src/http-schemas/healthz.schema";
import { TxManagerService } from "@src/services/tx-manager/tx-manager.service";

@singleton()
export class HealthzController {
  constructor(@inject(TxManagerService) private readonly txManagerService: TxManagerService) {}

  async getStatus(type: string): Promise<HealthzResponse> {
    if (type === "readiness") {
      await this.#assertEveryFundingWalletIsReachable();
    }

    return {
      data: {
        status: "ok"
      }
    };
  }

  /** A pod that cannot name its funding wallets would refuse every transaction, so it must not take traffic. */
  async #assertEveryFundingWalletIsReachable(): Promise<void> {
    try {
      await this.txManagerService.getFundingWalletAddresses();
    } catch (cause) {
      throw createError(503, "A funding wallet key is unreachable", { cause });
    }
  }
}
