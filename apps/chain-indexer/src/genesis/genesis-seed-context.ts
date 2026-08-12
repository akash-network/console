import type { ParsedGenesis } from "@src/genesis/genesis-schema";
import type { ChainTransaction } from "@src/providers/db.provider";

/** Shared context passed to each module seeder: the interned address→id map plus the genesis height. */
export interface GenesisSeedContext {
  accountIdByAddress: ReadonlyMap<string, number>;
  initialHeight: number;
}

/** A per-module genesis seeder, matching the design's `ModuleDefinition.genesisSeeder`. Runs inside the shared import transaction. */
export interface GenesisModuleSeeder {
  seed(tx: ChainTransaction, genesis: ParsedGenesis, context: GenesisSeedContext): Promise<void>;
}
