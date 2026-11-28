import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import type { FundingFreeze } from "@src/model-schemas";
import { FundingControlsDatabase } from "@src/providers/funding-controls-database.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { FundingFreezeRepository } from "@src/repositories/funding-freeze/funding-freeze.repository";

/** A read that fails falls back on the last one for this long, so a database blip refuses nothing while a signer cut off from the freeze still stops within a minute. */
const MAX_MS_TRUSTING_LAST_FREEZE_READ = 60_000;

type FreezeRead = { freeze: FundingFreeze | undefined; readAtMs: number };

@singleton()
export class FundingFreezeService {
  #lastRead: FreezeRead | undefined;

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
      const lastRead = this.#lastRead;
      const isLastReadTrusted = lastRead !== undefined && Date.now() - lastRead.readAtMs <= MAX_MS_TRUSTING_LAST_FREEZE_READ;
      this.logger.error({ event: "FUNDING_FREEZE_UNREADABLE", isLastReadTrusted, error });

      if (!isLastReadTrusted) {
        throw createError(503, "The funding freeze could not be read, so no grant, transfer or deposit from a funding wallet is signed", { cause: error });
      }

      return lastRead.freeze;
    }
  }

  async #read(): Promise<FundingFreeze | undefined> {
    const freeze = await this.repository.findActive();
    this.#lastRead = { freeze, readAtMs: Date.now() };

    return freeze;
  }
}
