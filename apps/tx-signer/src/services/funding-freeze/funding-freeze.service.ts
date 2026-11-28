import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { RecentRead } from "@src/lib/recent-read/recent-read";
import type { FundingFreeze } from "@src/model-schemas";
import { FundingControlsDatabase } from "@src/providers/funding-controls-database.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { FundingFreezeRepository } from "@src/repositories/funding-freeze/funding-freeze.repository";

/** A read that fails falls back on the last one for this long, so a database blip refuses nothing while a signer cut off from the freeze still stops within a minute. */
const MAX_MS_TRUSTING_LAST_FREEZE_READ = 60_000;

@singleton()
export class FundingFreezeService {
  readonly #recentFreeze = new RecentRead<FundingFreeze | undefined>(MAX_MS_TRUSTING_LAST_FREEZE_READ);

  constructor(
    @inject(FundingControlsDatabase) private readonly database: FundingControlsDatabase,
    @inject(FundingFreezeRepository) private readonly repository: FundingFreezeRepository,
    @inject(LoggerService) private readonly logger: LoggerService
  ) {
    this.logger.setContext(FundingFreezeService.name);
  }

  /** Reads the freeze before the signer listens, so a database it cannot reach fails the start instead of the first request. */
  async load(): Promise<void> {
    if (!this.database.isConfigured) {
      this.logger.info({ event: "FUNDING_FREEZE_OFF" });
      return;
    }

    const freeze = await this.#read();
    this.logger.info({ event: "FUNDING_FREEZE_LOADED", isFrozen: freeze !== undefined });
  }

  async assertFundingIsNotFrozen(): Promise<void> {
    if (!this.database.isConfigured) return;

    const freeze = await this.#readOrRecall();

    if (!freeze) return;

    this.logger.warn({ event: "FUNDING_FROZEN_REQUEST_REFUSED", reason: freeze.reason, frozenBy: freeze.frozenBy, frozenAt: freeze.frozenAt });
    throw createError(503, "Funding is frozen, so no grant, transfer or deposit from a funding wallet is signed");
  }

  async #readOrRecall(): Promise<FundingFreeze | undefined> {
    try {
      return await this.#read();
    } catch (error) {
      const recentFreeze = this.#recentFreeze.recall();
      this.logger.error({ event: "FUNDING_FREEZE_UNREADABLE", isLastReadTrusted: recentFreeze !== undefined, error });

      if (!recentFreeze) {
        throw createError(503, "The funding freeze could not be read, so no grant, transfer or deposit from a funding wallet is signed", { cause: error });
      }

      return recentFreeze.value;
    }
  }

  async #read(): Promise<FundingFreeze | undefined> {
    return await this.#recentFreeze.refresh(() => this.repository.findActive());
  }
}
