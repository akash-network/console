import { and, eq, inArray, lte, sql } from "drizzle-orm";
import chunk from "lodash/chunk";
import { inject, singleton } from "tsyringe";

import type { AkashBlockChanges, ProviderAttribute, ProviderChange } from "@src/akash/akash-changes";
import { isProviderChange } from "@src/akash/akash-changes";
import { INSERT_CHUNK_SIZE } from "@src/db/insert-chunk-size";
import { ProviderAuditSignatures, Providers } from "@src/db/schema";
import { sqlExcluded } from "@src/db/sql-excluded";
import type { ChainTransaction } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

interface ProviderBlockChanges {
  height: number;
  changes: ProviderChange[];
}

interface ProviderState {
  ownerAccountId: number;
  hostUri: string;
  email: string | null;
  website: string | null;
  attributes: ProviderAttribute[];
  lastProcessedHeight: number;
  createdHeight: number;
  updatedHeight: number | null;
  deletedHeight: number | null;
  touched: boolean;
}

interface ProviderWarning {
  code: "PROVIDER_ORPHAN_REFERENCE";
  kind: ProviderChange["kind"];
  owner: string;
  height: number;
}

/**
 * Persists the provider registry and audited attributes inside the block transaction, mirroring the
 * fold-then-flush shape of AkashWriter for the aggregate keyed by owner instead of (owner, dseq).
 * Provider rows are locked FOR UPDATE in ascending owner-account order and flushed with the
 * `last_processed_height` watermark guard, so overlapping writers replaying the same blocks stay
 * idempotent. Audit signatures skip the fold: each sign/unsign applies in block order with a per-row
 * height guard, since x/audit state is independent of x/provider and audit traffic is sparse.
 */
@singleton()
export class ProviderWriter {
  readonly #logger: LoggerService;

  constructor(@inject(LoggerService) logger: LoggerService) {
    this.#logger = logger;
    this.#logger.setContext("PROVIDER_WRITER");
  }

  async write(tx: ChainTransaction, blocks: AkashBlockChanges[], accountIds: Map<string, number>): Promise<void> {
    const withChanges = blocks
      .map(block => ({ height: block.height, changes: block.changes.filter(isProviderChange) }))
      .filter(block => block.changes.length > 0);
    if (withChanges.length === 0) {
      return;
    }

    await this.#writeProviders(tx, withChanges, accountIds);
    await this.#writeAuditSignatures(tx, withChanges, accountIds);
  }

  async #writeProviders(tx: ChainTransaction, blocks: ProviderBlockChanges[], accountIds: Map<string, number>): Promise<void> {
    const ownerIds = this.#collectOwnerIds(blocks, accountIds);
    if (ownerIds.size === 0) {
      return;
    }

    const states = await this.#loadStates(
      tx,
      [...ownerIds.values()].sort((a, b) => a - b)
    );
    const warnings: ProviderWarning[] = [];

    for (const block of blocks) {
      this.#applyBlockChanges(states, block, ownerIds, warnings);
    }
    this.#logWarnings(warnings);

    const touched = [...states.values()].filter(state => state.touched);
    if (touched.length === 0) {
      return;
    }

    await tx
      .insert(Providers)
      .values(touched.map(({ touched: _, ...row }) => row))
      .onConflictDoUpdate({
        target: Providers.ownerAccountId,
        set: {
          hostUri: sqlExcluded("host_uri"),
          email: sqlExcluded("email"),
          website: sqlExcluded("website"),
          attributes: sqlExcluded("attributes"),
          lastProcessedHeight: sqlExcluded("last_processed_height"),
          createdHeight: sqlExcluded("created_height"),
          updatedHeight: sqlExcluded("updated_height"),
          deletedHeight: sqlExcluded("deleted_height")
        },
        setWhere: sql`excluded.last_processed_height >= ${Providers.lastProcessedHeight}`
      });
  }

  #applyBlockChanges(states: Map<number, ProviderState>, block: ProviderBlockChanges, ownerIds: Map<string, number>, warnings: ProviderWarning[]): void {
    const skippedOwners = this.#ownersAtOrPastWatermark(states, block.height);

    for (const change of block.changes) {
      if (change.kind === "providerAttributesSigned" || change.kind === "providerAttributesUnsigned") {
        continue;
      }
      const ownerAccountId = this.#requireId(ownerIds, change.owner);
      if (skippedOwners.has(ownerAccountId)) {
        continue;
      }

      const state = states.get(ownerAccountId);
      if (change.kind === "providerCreated") {
        states.set(ownerAccountId, {
          ownerAccountId,
          hostUri: change.hostUri,
          email: change.email,
          website: change.website,
          attributes: change.attributes,
          lastProcessedHeight: block.height,
          createdHeight: block.height,
          updatedHeight: null,
          deletedHeight: null,
          touched: true
        });
        continue;
      }

      if (!state) {
        warnings.push({ code: "PROVIDER_ORPHAN_REFERENCE", kind: change.kind, owner: change.owner, height: block.height });
        continue;
      }

      if (change.kind === "providerUpdated") {
        state.hostUri = change.hostUri;
        state.email = change.email;
        state.website = change.website;
        state.attributes = change.attributes;
        state.updatedHeight = block.height;
      } else {
        state.deletedHeight = block.height;
      }
      state.lastProcessedHeight = block.height;
      state.touched = true;
    }
  }

  /** Providers already at or past this block's height saw it in a previous commit; the whole block is a duplicate for them. */
  #ownersAtOrPastWatermark(states: Map<number, ProviderState>, height: number): Set<number> {
    const skipped = new Set<number>();
    for (const state of states.values()) {
      if (state.lastProcessedHeight >= height) {
        skipped.add(state.ownerAccountId);
      }
    }
    return skipped;
  }

  async #writeAuditSignatures(tx: ChainTransaction, blocks: ProviderBlockChanges[], accountIds: Map<string, number>): Promise<void> {
    for (const block of blocks) {
      for (const change of block.changes) {
        if (change.kind === "providerAttributesSigned") {
          await this.#upsertSignatures(tx, change, block.height, accountIds);
        } else if (change.kind === "providerAttributesUnsigned") {
          await this.#deleteSignatures(tx, change, block.height, accountIds);
        }
      }
    }
  }

  async #upsertSignatures(
    tx: ChainTransaction,
    change: Extract<ProviderChange, { kind: "providerAttributesSigned" }>,
    height: number,
    accountIds: Map<string, number>
  ): Promise<void> {
    const ownerAccountId = this.#requireId(accountIds, change.owner);
    const auditorAccountId = this.#requireId(accountIds, change.auditor);
    const rows = dedupeByKeyLastWins(change.attributes).map(attribute => ({
      ownerAccountId,
      auditorAccountId,
      key: attribute.key,
      value: attribute.value,
      height
    }));

    for (const rowChunk of chunk(rows, INSERT_CHUNK_SIZE)) {
      await tx
        .insert(ProviderAuditSignatures)
        .values(rowChunk)
        .onConflictDoUpdate({
          target: [ProviderAuditSignatures.ownerAccountId, ProviderAuditSignatures.auditorAccountId, ProviderAuditSignatures.key],
          set: { value: sqlExcluded("value"), height: sqlExcluded("height") },
          setWhere: sql`excluded.height >= ${ProviderAuditSignatures.height}`
        });
    }
  }

  /** The `height <=` guard keeps a replayed delete from removing a signature re-signed at a later height. */
  async #deleteSignatures(
    tx: ChainTransaction,
    change: Extract<ProviderChange, { kind: "providerAttributesUnsigned" }>,
    height: number,
    accountIds: Map<string, number>
  ): Promise<void> {
    const identity = and(
      eq(ProviderAuditSignatures.ownerAccountId, this.#requireId(accountIds, change.owner)),
      eq(ProviderAuditSignatures.auditorAccountId, this.#requireId(accountIds, change.auditor)),
      lte(ProviderAuditSignatures.height, height)
    );
    await tx.delete(ProviderAuditSignatures).where(change.keys.length > 0 ? and(identity, inArray(ProviderAuditSignatures.key, change.keys)) : identity);
  }

  #collectOwnerIds(blocks: ProviderBlockChanges[], accountIds: Map<string, number>): Map<string, number> {
    const ownerIds = new Map<string, number>();
    for (const block of blocks) {
      for (const change of block.changes) {
        if (change.kind === "providerCreated" || change.kind === "providerUpdated" || change.kind === "providerDeleted") {
          ownerIds.set(change.owner, this.#requireId(accountIds, change.owner));
        }
      }
    }
    return ownerIds;
  }

  async #loadStates(tx: ChainTransaction, ownerAccountIds: number[]): Promise<Map<number, ProviderState>> {
    const rows = await tx.select().from(Providers).where(inArray(Providers.ownerAccountId, ownerAccountIds)).orderBy(Providers.ownerAccountId).for("update");

    return new Map(rows.map(row => [row.ownerAccountId, { ...row, touched: false }]));
  }

  #logWarnings(warnings: ProviderWarning[]): void {
    if (warnings.length === 0) {
      return;
    }
    this.#logger.warn({ event: "PROVIDER_ORPHAN_REFERENCE", count: warnings.length, samples: warnings.slice(0, 5) });
  }

  #requireId(accountIds: Map<string, number>, address: string): number {
    const id = accountIds.get(address);
    if (id === undefined) {
      throw new Error(`No interned account id for address ${address}`);
    }
    return id;
  }
}

/**
 * A message may sign the same key twice; feeding both rows to one ON CONFLICT DO UPDATE would raise
 * `21000: command cannot affect row a second time`, so collapse to the last occurrence.
 */
function dedupeByKeyLastWins(attributes: ProviderAttribute[]): ProviderAttribute[] {
  return [...new Map(attributes.map(attribute => [attribute.key, attribute])).values()];
}
