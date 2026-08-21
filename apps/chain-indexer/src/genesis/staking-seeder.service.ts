import { singleton } from "tsyringe";

import { insertChunked } from "@src/db/insert-chunked";
import { Delegations, Validators } from "@src/db/schema";
import type { ParsedGenesis } from "@src/genesis/genesis-schema";
import type { GenesisModuleSeeder, GenesisSeedContext } from "@src/genesis/genesis-seed-context";
import type { ChainTransaction } from "@src/providers/db.provider";

@singleton()
export class StakingSeeder implements GenesisModuleSeeder {
  /**
   * Seeds validators (from `staking.validators` and `genutil.gen_txs` create-validator messages) and
   * explicit `staking.delegations`. Genesis gentx self-delegations are applied at InitChain rather than
   * listed in `staking.delegations`, so they are intentionally not reconstructed here.
   */
  async seed(tx: ChainTransaction, genesis: ParsedGenesis, context: GenesisSeedContext): Promise<void> {
    const validatorRows: (typeof Validators.$inferInsert)[] = genesis.validators.map(validator => ({
      operatorAddress: validator.operatorAddress,
      accountAddress: validator.accountAddress,
      hexAddress: validator.hexAddress,
      moniker: validator.moniker,
      identity: validator.identity,
      website: validator.website,
      details: validator.details,
      securityContact: validator.securityContact,
      commissionRate: validator.commissionRate,
      commissionMaxRate: validator.commissionMaxRate,
      commissionMaxChangeRate: validator.commissionMaxChangeRate,
      minSelfDelegation: validator.minSelfDelegation
    }));

    const delegationRows: (typeof Delegations.$inferInsert)[] = genesis.delegations.map(delegation => {
      const delegatorAccountId = context.accountIdByAddress.get(delegation.delegatorAddress);
      if (delegatorAccountId === undefined) {
        throw new Error(`No interned account id for delegator ${delegation.delegatorAddress}`);
      }

      return { delegatorAccountId, validatorOperatorAddress: delegation.validatorOperatorAddress, shares: delegation.shares };
    });

    await insertChunked(tx, Validators, validatorRows);
    await insertChunked(tx, Delegations, delegationRows);
  }
}
