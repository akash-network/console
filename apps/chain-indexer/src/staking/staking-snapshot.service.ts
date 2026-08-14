import { sql } from "drizzle-orm";
import chunk from "lodash/chunk";
import { inject, singleton } from "tsyringe";

import { INSERT_CHUNK_SIZE } from "@src/db/insert-chunk-size";
import { insertChunked } from "@src/db/insert-chunked";
import { Delegations, UnbondingDelegations, Validators } from "@src/db/schema";
import { retryWithBackoff } from "@src/lib/retry-with-backoff/retry-with-backoff";
import { AccountInterner } from "@src/pipeline/balance/account-interner.service";
import type { ChainDatabase, ChainTransaction } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { RpcClientPool } from "@src/rpc/rpc-client-pool.service";
import type { Page, SnapshotDelegation, SnapshotUnbondingEntry, SnapshotValidator } from "@src/staking/staking-query";
import {
  decodeValidatorDelegations,
  decodeValidators,
  decodeValidatorUnbonding,
  encodeValidatorDelegationsRequest,
  encodeValidatorsRequest,
  encodeValidatorUnbondingRequest,
  VALIDATOR_DELEGATIONS_PATH,
  VALIDATOR_UNBONDING_PATH,
  VALIDATORS_PATH
} from "@src/staking/staking-query";

/** Validators whose delegations and unbonding are fetched at once. Kept small so a single archival node is not flooded with parallel TLS handshakes. */
const SNAPSHOT_FETCH_CONCURRENCY = 2;
const SNAPSHOT_QUERY_RETRIES = 5;
const SNAPSHOT_QUERY_RETRY_BASE_MS = 1_000;

/**
 * Reconciles validators, delegations and unbonding to the chain's own answer, because delegation *shares*
 * cannot be derived exactly from messages — the token↔share rate drifts with every reward and slash. The
 * whole set is fetched before any write, so a failed query aborts the run without touching the tables.
 * Delegations and unbonding are fully replaced (an entry vanishes silently once it matures or fully
 * undelegates); validators are upserted, refreshing only the snapshot-owned bond state and leaving the
 * message-sourced descriptor, commission and addresses intact.
 */
@singleton()
export class StakingSnapshotService {
  readonly #db: ChainDatabase;
  readonly #rpc: RpcClientPool;
  readonly #interner: AccountInterner;
  readonly #logger: LoggerService;

  constructor(
    @inject(CHAIN_DB) db: ChainDatabase,
    @inject(RpcClientPool) rpc: RpcClientPool,
    @inject(AccountInterner) interner: AccountInterner,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#db = db;
    this.#rpc = rpc;
    this.#interner = interner;
    this.#logger = logger;
    this.#logger.setContext("STAKING_SNAPSHOT");
  }

  async snapshot(height: number): Promise<void> {
    const validators = await this.#fetchAll(height, VALIDATORS_PATH, encodeValidatorsRequest, decodeValidators);
    if (validators.length === 0) {
      this.#logger.warn({ event: "STAKING_SNAPSHOT_NO_VALIDATORS", height });
      return;
    }

    const delegations: SnapshotDelegation[] = [];
    const unbonding: SnapshotUnbondingEntry[] = [];
    for (const batch of chunk(validators, SNAPSHOT_FETCH_CONCURRENCY)) {
      const stakes = await Promise.all(batch.map(({ operatorAddress }) => this.#fetchValidatorStake(height, operatorAddress)));
      for (const stake of stakes) {
        delegations.push(...stake.delegations);
        unbonding.push(...stake.unbonding);
      }
    }

    const accountIds = await this.#interner.resolve([
      ...delegations.map(delegation => delegation.delegatorAddress),
      ...unbonding.map(entry => entry.delegatorAddress)
    ]);

    await this.#db.transaction(async tx => {
      await this.#upsertValidators(tx, validators);
      await this.#replaceDelegations(tx, delegations, accountIds);
      await this.#replaceUnbonding(tx, unbonding, accountIds);
    });

    this.#logger.info({
      event: "STAKING_SNAPSHOT_WRITTEN",
      height,
      validators: validators.length,
      delegations: delegations.length,
      unbonding: unbonding.length
    });
  }

  /** A validator's delegations and unbonding entries fetched concurrently; both are read-only and pinned to `height`. */
  async #fetchValidatorStake(height: number, operatorAddress: string): Promise<{ delegations: SnapshotDelegation[]; unbonding: SnapshotUnbondingEntry[] }> {
    const [delegations, unbonding] = await Promise.all([
      this.#fetchAll(
        height,
        VALIDATOR_DELEGATIONS_PATH,
        key => encodeValidatorDelegationsRequest(operatorAddress, key),
        value => decodeValidatorDelegations(operatorAddress, value)
      ),
      this.#fetchAll(
        height,
        VALIDATOR_UNBONDING_PATH,
        key => encodeValidatorUnbondingRequest(operatorAddress, key),
        value => decodeValidatorUnbonding(operatorAddress, value)
      )
    ]);
    return { delegations, unbonding };
  }

  /** Walks a paginated staking query to exhaustion, following the node's `next_key` cursor across pages. */
  async #fetchAll<T>(height: number, path: string, encode: (key: Uint8Array) => string, decode: (value: string | null) => Page<T>): Promise<T[]> {
    const items: T[] = [];
    let key: Uint8Array = new Uint8Array();

    for (;;) {
      const response = await retryWithBackoff(() => this.#rpc.abciQuery(path, encode(key), height), {
        maxAttempts: SNAPSHOT_QUERY_RETRIES,
        baseDelayMs: SNAPSHOT_QUERY_RETRY_BASE_MS,
        onRetry: (error, attempt, delayMs) => this.#logger.warn({ event: "STAKING_SNAPSHOT_QUERY_RETRY", path, height, attempt, delayMs, error })
      });
      const page = decode(response.value);
      items.push(...page.items);
      if (!page.nextKey) {
        return items;
      }
      key = page.nextKey;
    }
  }

  /** Upserts the full validator row, including the consensus `hexAddress` derived from the query's pubkey, so post-genesis validators are not left with a null one. */
  async #upsertValidators(tx: ChainTransaction, validators: SnapshotValidator[]): Promise<void> {
    const rows = validators.map(validator => ({
      operatorAddress: validator.operatorAddress,
      hexAddress: validator.hexAddress,
      accountAddress: validator.accountAddress,
      moniker: validator.moniker,
      identity: validator.identity,
      website: validator.website,
      details: validator.details,
      securityContact: validator.securityContact,
      commissionRate: validator.commissionRate,
      commissionMaxRate: validator.commissionMaxRate,
      commissionMaxChangeRate: validator.commissionMaxChangeRate,
      minSelfDelegation: validator.minSelfDelegation,
      jailed: validator.jailed,
      status: validator.status,
      tokens: validator.tokens,
      delegatorShares: validator.delegatorShares,
      unbondingHeight: validator.unbondingHeight,
      unbondingTime: validator.unbondingTime
    }));

    for (const rowChunk of chunk(rows, INSERT_CHUNK_SIZE)) {
      await tx
        .insert(Validators)
        .values(rowChunk)
        .onConflictDoUpdate({
          target: Validators.operatorAddress,
          set: {
            hexAddress: sql`excluded.hex_address`,
            accountAddress: sql`excluded.account_address`,
            moniker: sql`excluded.moniker`,
            identity: sql`excluded.identity`,
            website: sql`excluded.website`,
            details: sql`excluded.details`,
            securityContact: sql`excluded.security_contact`,
            commissionRate: sql`excluded.commission_rate`,
            commissionMaxRate: sql`excluded.commission_max_rate`,
            commissionMaxChangeRate: sql`excluded.commission_max_change_rate`,
            minSelfDelegation: sql`excluded.min_self_delegation`,
            jailed: sql`excluded.jailed`,
            status: sql`excluded.status`,
            tokens: sql`excluded.tokens`,
            delegatorShares: sql`excluded.delegator_shares`,
            unbondingHeight: sql`excluded.unbonding_height`,
            unbondingTime: sql`excluded.unbonding_time`
          }
        });
    }
  }

  async #replaceDelegations(tx: ChainTransaction, delegations: SnapshotDelegation[], accountIds: Map<string, number>): Promise<void> {
    await tx.delete(Delegations);

    const rows = delegations.map(delegation => ({
      delegatorAccountId: this.#requireId(accountIds, delegation.delegatorAddress),
      validatorOperatorAddress: delegation.validatorOperatorAddress,
      shares: delegation.shares
    }));

    await insertChunked(tx, Delegations, rows, { onConflictDoNothing: false });
  }

  async #replaceUnbonding(tx: ChainTransaction, unbonding: SnapshotUnbondingEntry[], accountIds: Map<string, number>): Promise<void> {
    await tx.delete(UnbondingDelegations);

    const rows = unbonding.map(entry => ({
      delegatorAccountId: this.#requireId(accountIds, entry.delegatorAddress),
      validatorOperatorAddress: entry.validatorOperatorAddress,
      creationHeight: entry.creationHeight,
      completionTime: entry.completionTime,
      initialBalance: entry.initialBalance,
      balance: entry.balance
    }));

    await insertChunked(tx, UnbondingDelegations, rows, { onConflictDoNothing: false });
  }

  #requireId(accountIds: Map<string, number>, address: string): number {
    const accountId = accountIds.get(address);
    if (accountId === undefined) {
      throw new Error(`No interned account id for delegator ${address}`);
    }
    return accountId;
  }
}
