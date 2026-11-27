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

  /** Guards start-up only: a pod names its wallets once, and a key service outage after that must not take pods out, since most transactions need no key service signature. */
  async #assertEveryFundingWalletIsReachable(): Promise<void> {
    try {
      await this.txManagerService.getFundingWalletAddresses();
    } catch (cause) {
      throw createError(503, "A funding wallet key is unreachable", { cause });
    }
  }
}
