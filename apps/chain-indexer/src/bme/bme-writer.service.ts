import { inject, singleton } from "tsyringe";

import type { BmeBlockChanges, BmeChange } from "@src/bme/bme-deriver";
import { insertChunked } from "@src/db/insert-chunked";
import { BmeCanceledRecords, BmeLedgerRecords, BmeStatusChanges } from "@src/db/schema";
import { requireAccountId } from "@src/pipeline/balance/account-interner.service";
import type { ChainTransaction } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

type LedgerRecordRow = typeof BmeLedgerRecords.$inferInsert;
type StatusChangeRow = typeof BmeStatusChanges.$inferInsert;
type CanceledRecordRow = typeof BmeCanceledRecords.$inferInsert;

/**
 * Persists the BME lifecycle inside the block transaction. Rows are plain conflict-ignoring appends —
 * ledger and canceled records are keyed by the on-chain LedgerRecordID and status changes by
 * (height, ordinal), so replaying a block is a no-op without locks or watermarks.
 */
@singleton()
export class BmeWriter {
  readonly #logger: LoggerService;

  constructor(@inject(LoggerService) logger: LoggerService) {
    this.#logger = logger;
    this.#logger.setContext("BME_WRITER");
  }

  async write(tx: ChainTransaction, blocks: BmeBlockChanges[], accountIds: Map<string, number>): Promise<void> {
    this.#logWarnings(blocks);

    const ledgerRecords: LedgerRecordRow[] = [];
    const statusChanges: StatusChangeRow[] = [];
    const canceledRecords: CanceledRecordRow[] = [];

    for (const block of blocks) {
      for (const change of block.changes) {
        if (change.kind === "ledgerRecordExecuted") {
          ledgerRecords.push(this.#ledgerRecordRow(block.height, change, accountIds));
        } else if (change.kind === "mintStatusChange") {
          statusChanges.push(this.#statusChangeRow(block.height, change));
        } else {
          canceledRecords.push(this.#canceledRecordRow(block.height, change, accountIds));
        }
      }
    }

    await insertChunked(tx, BmeLedgerRecords, ledgerRecords);
    await insertChunked(tx, BmeStatusChanges, statusChanges);
    await insertChunked(tx, BmeCanceledRecords, canceledRecords);
  }

  #ledgerRecordRow(height: number, change: Extract<BmeChange, { kind: "ledgerRecordExecuted" }>, accountIds: Map<string, number>): LedgerRecordRow {
    return {
      denom: change.id.denom,
      toDenom: change.id.toDenom,
      source: change.id.source,
      recordHeight: change.id.recordHeight,
      sequence: change.id.sequence,
      height,
      txIndex: change.txIndex,
      burnedFromAccountId: requireAccountId(accountIds, change.burnedFrom),
      mintedToAccountId: requireAccountId(accountIds, change.mintedTo),
      burnedDenom: change.burned?.denom ?? null,
      burnedAmount: change.burned?.amount ?? "0",
      burnedPrice: change.burned?.price ?? null,
      mintedDenom: change.minted?.denom ?? null,
      mintedAmount: change.minted?.amount ?? "0",
      mintedPrice: change.minted?.price ?? null,
      spreadDenom: change.spread?.denom ?? null,
      spreadAmount: change.spread?.amount ?? null,
      remintCreditIssuedAmount: change.remintCreditIssued?.amount ?? null,
      remintCreditAccruedAmount: change.remintCreditAccrued?.amount ?? null
    };
  }

  #statusChangeRow(height: number, change: Extract<BmeChange, { kind: "mintStatusChange" }>): StatusChangeRow {
    return {
      height,
      ordinal: change.ordinal,
      previousStatus: change.previousStatus,
      newStatus: change.newStatus,
      collateralRatio: change.collateralRatio
    };
  }

  #canceledRecordRow(height: number, change: Extract<BmeChange, { kind: "ledgerRecordCanceled" }>, accountIds: Map<string, number>): CanceledRecordRow {
    return {
      denom: change.id.denom,
      toDenom: change.id.toDenom,
      source: change.id.source,
      recordHeight: change.id.recordHeight,
      sequence: change.id.sequence,
      height,
      txIndex: change.txIndex,
      cancelReason: change.cancelReason,
      ownerAccountId: requireAccountId(accountIds, change.owner),
      toAccountId: requireAccountId(accountIds, change.to),
      coinsToBurnDenom: change.coinsToBurn?.denom ?? null,
      coinsToBurnAmount: change.coinsToBurn?.amount ?? null,
      denomToMint: change.denomToMint
    };
  }

  #logWarnings(blocks: BmeBlockChanges[]): void {
    const warnings = blocks.flatMap(block => block.warnings);
    if (warnings.length === 0) {
      return;
    }
    this.#logger.warn({ event: "BME_EVENT_PARSE_FAILED", count: warnings.length, samples: warnings.slice(0, 5) });
  }
}
