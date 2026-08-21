import { eq } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { IndexerState } from "@src/db/schema";
import { AccountSeeder } from "@src/genesis/account-seeder.service";
import { BankSeeder } from "@src/genesis/bank-seeder.service";
import { GenesisMidChainError } from "@src/genesis/genesis-mid-chain-error";
import type { GenesisSource } from "@src/genesis/genesis-source";
import { GENESIS_SOURCE } from "@src/genesis/genesis-source";
import { StakingSeeder } from "@src/genesis/staking-seeder.service";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

export const GENESIS_STREAM = "genesis";

@singleton()
export class GenesisImportService {
  readonly #db: ChainDatabase;
  readonly #source: GenesisSource;
  readonly #accountSeeder: AccountSeeder;
  readonly #bankSeeder: BankSeeder;
  readonly #stakingSeeder: StakingSeeder;
  readonly #logger: LoggerService;

  constructor(
    @inject(CHAIN_DB) db: ChainDatabase,
    @inject(GENESIS_SOURCE) source: GenesisSource,
    @inject(AccountSeeder) accountSeeder: AccountSeeder,
    @inject(BankSeeder) bankSeeder: BankSeeder,
    @inject(StakingSeeder) stakingSeeder: StakingSeeder,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#db = db;
    this.#source = source;
    this.#accountSeeder = accountSeeder;
    this.#bankSeeder = bankSeeder;
    this.#stakingSeeder = stakingSeeder;
    this.#logger = logger;
    this.#logger.setContext("GENESIS_IMPORT");
  }

  /**
   * Seeds genesis state exactly once, before the first block. Rejects a fresh balance-tracking start
   * whose start height is not the network's genesis height, so balances can never begin mid-chain.
   * Safe to call on every fresh start: the marker row makes a repeat run a no-op, and the whole seed
   * commits in one transaction so a crash mid-seed rolls back and retries cleanly.
   */
  async ensureSeeded(startHeight: number): Promise<void> {
    const genesis = await this.#source.fetchGenesis();

    if (startHeight !== genesis.initialHeight) {
      throw new GenesisMidChainError(
        `Balance tracking must start at genesis height ${genesis.initialHeight}, but the effective start height is ${startHeight}. Set SYNC_START_HEIGHT=${genesis.initialHeight} to index from genesis.`
      );
    }

    const marker = await this.#findMarker();
    if (marker) {
      this.#logger.info({ event: "GENESIS_ALREADY_SEEDED", height: marker.lastHeight });
      return;
    }

    if (genesis.unknownAccountTypes.length > 0) {
      this.#logger.warn({ event: "GENESIS_UNKNOWN_ACCOUNT_TYPES", types: genesis.unknownAccountTypes });
    }

    await this.#db.transaction(async tx => {
      const claimed = await tx
        .insert(IndexerState)
        .values({ stream: GENESIS_STREAM, lastHeight: genesis.initialHeight, updatedAt: new Date() })
        .onConflictDoNothing()
        .returning();

      if (claimed.length === 0) {
        this.#logger.info({ event: "GENESIS_SEED_SKIPPED_CONCURRENT" });
        return;
      }

      const accountIdByAddress = await this.#accountSeeder.intern(tx, genesis);
      const context = { accountIdByAddress, initialHeight: genesis.initialHeight };
      await this.#bankSeeder.seed(tx, genesis, context);
      await this.#stakingSeeder.seed(tx, genesis, context);

      this.#logger.info({
        event: "GENESIS_SEEDED",
        chainId: genesis.chainId,
        initialHeight: genesis.initialHeight,
        accounts: accountIdByAddress.size,
        balances: genesis.balances.length,
        validators: genesis.validators.length,
        delegations: genesis.delegations.length
      });
    });
  }

  /** Whether the one-time genesis seed has already run. Lets the sync runner detect a resume that turned the flag on too late to seed. */
  async hasSeeded(): Promise<boolean> {
    return (await this.#findMarker()) !== undefined;
  }

  async #findMarker() {
    const [marker] = await this.#db.select().from(IndexerState).where(eq(IndexerState.stream, GENESIS_STREAM));
    return marker;
  }
}
