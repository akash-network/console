import type { AkashBlock as Block } from "@akashnetwork/database/dbSchemas/akash";
import { BmeLedgerRecord, BmeRawEvent, BmeStatusChange } from "@akashnetwork/database/dbSchemas/akash";
import type { Transaction, TransactionEvent } from "@akashnetwork/database/dbSchemas/base";
import type { DecodedTxRaw } from "@cosmjs/proto-signing";
import type { Transaction as DbTransaction } from "sequelize";

import type { IGenesis } from "@src/chain/genesisTypes";
import * as benchmark from "@src/shared/utils/benchmark";
import { Indexer } from "./indexer";

export const BME_EVENT_TYPES = {
  LEDGER_RECORD_EXECUTED: "akash.bme.v1.EventLedgerRecordExecuted",
  MINT_STATUS_CHANGE: "akash.bme.v1.EventMintStatusChange",
  VAULT_SEEDED: "akash.bme.v1.EventVaultSeeded"
} as const;

const BME_EVENT_TYPE_VALUES = Object.values(BME_EVENT_TYPES);

interface ParsedLedgerRecord {
  burnedFrom: string;
  mintedTo: string;
  burnedDenom: string;
  burnedAmount: string;
  burnedPrice: string | null;
  mintedDenom: string;
  mintedAmount: string;
  mintedPrice: string | null;
  remintCreditIssuedAmount: string | null;
  remintCreditAccruedAmount: string | null;
}

interface ParsedStatusChange {
  previousStatus: string;
  newStatus: string;
  collateralRatio: string;
}

interface ParsedVaultSeeded {
  amount: string;
  denom: string;
}

function parseCoinString(coin: string): { amount: string; denom: string } {
  const match = coin.match(/^(\d+)(.+)$/);
  if (!match) return { amount: "0", denom: "" };
  return { amount: match[1], denom: match[2] };
}

function parseJsonObj(value: string | null): Record<string, string> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return null;
  } catch {
    return null;
  }
}

function parseLedgerRecordEvent(data: Record<string, string | null>): ParsedLedgerRecord {
  const burned = parseJsonObj(data.burned);
  const minted = parseJsonObj(data.minted);
  const burnedCoin = burned?.amount ? parseCoinString(burned.amount) : { amount: "0", denom: "" };
  const mintedCoin = minted?.amount ? parseCoinString(minted.amount) : { amount: "0", denom: "" };

  const remintCreditIssued = parseJsonObj(data.remint_credit_issued);
  const remintCreditAccrued = parseJsonObj(data.remint_credit_accrued);
  const remintIssuedCoin = remintCreditIssued?.amount ? parseCoinString(remintCreditIssued.amount) : null;
  const remintAccruedCoin = remintCreditAccrued?.amount ? parseCoinString(remintCreditAccrued.amount) : null;

  return {
    burnedFrom: burned?.address || "",
    mintedTo: minted?.address || "",
    burnedDenom: burnedCoin.denom,
    burnedAmount: burnedCoin.amount,
    burnedPrice: data.burned_price || null,
    mintedDenom: mintedCoin.denom,
    mintedAmount: mintedCoin.amount,
    mintedPrice: data.minted_price || null,
    remintCreditIssuedAmount: remintIssuedCoin?.amount || null,
    remintCreditAccruedAmount: remintAccruedCoin?.amount || null
  };
}

function parseStatusChangeEvent(data: Record<string, string | null>): ParsedStatusChange {
  return {
    previousStatus: data.previous_status || data.old_status || "",
    newStatus: data.new_status || data.status || "",
    collateralRatio: data.collateral_ratio || "0"
  };
}

function parseVaultSeededEvent(data: Record<string, string | null>): ParsedVaultSeeded {
  const amount = parseJsonObj(data.amount);
  if (amount?.amount) {
    return parseCoinString(amount.amount);
  }
  return { amount: data.amount || "0", denom: data.denom || "uakt" };
}

function txEventToDataMap(event: TransactionEvent): Record<string, string | null> {
  const data: Record<string, string | null> = {};
  for (const attr of event.attributes || []) {
    data[attr.key] = attr.value;
  }
  return data;
}

interface BmeSums {
  aktBurned: number;
  actMinted: number;
  actBurned: number;
  aktReminted: number;
  creditIssued: number;
  creditAccrued: number;
}

function accumulateLedgerSums(sums: BmeSums, parsed: ParsedLedgerRecord): void {
  if (parsed.burnedDenom === "uakt") sums.aktBurned += parseFloat(parsed.burnedAmount);
  if (parsed.mintedDenom === "uact") sums.actMinted += parseFloat(parsed.mintedAmount);
  if (parsed.burnedDenom === "uact") sums.actBurned += parseFloat(parsed.burnedAmount);
  if (parsed.mintedDenom === "uakt") sums.aktReminted += parseFloat(parsed.mintedAmount);
  if (parsed.remintCreditIssuedAmount) sums.creditIssued += parseFloat(parsed.remintCreditIssuedAmount);
  if (parsed.remintCreditAccruedAmount) sums.creditAccrued += parseFloat(parsed.remintCreditAccruedAmount);
}

function zeroBmeSums(): BmeSums {
  return { aktBurned: 0, actMinted: 0, actBurned: 0, aktReminted: 0, creditIssued: 0, creditAccrued: 0 };
}

export { BME_EVENT_TYPE_VALUES };

export class BmeIndexer extends Indexer {
  private txLevelSums: BmeSums = zeroBmeSums();

  constructor() {
    super();
    this.name = "BmeIndexer";
    this.runForEveryBlocks = true;
    this.processFailedTxs = false;
    this.msgHandlers = {};
  }

  @benchmark.measureMethodAsync
  async dropTables(): Promise<void> {
    await BmeLedgerRecord.drop({ cascade: true });
    await BmeStatusChange.drop({ cascade: true });
    await BmeRawEvent.drop({ cascade: true });
  }

  async createTables(): Promise<void> {
    await BmeRawEvent.sync({ force: false });
    await BmeLedgerRecord.sync({ force: false });
    await BmeStatusChange.sync({ force: false });
  }

  async initCache(): Promise<void> {
    return Promise.resolve();
  }

  seed(_genesis: IGenesis): Promise<void> {
    return Promise.resolve();
  }

  private async persistBmeEvent(type: string, data: Record<string, string | null>, height: number, dbTransaction: DbTransaction, sums: BmeSums): Promise<void> {
    if (type === BME_EVENT_TYPES.LEDGER_RECORD_EXECUTED) {
      const parsed = parseLedgerRecordEvent(data);
      await BmeLedgerRecord.create({ height, ...parsed }, { transaction: dbTransaction });
      accumulateLedgerSums(sums, parsed);
    } else if (type === BME_EVENT_TYPES.MINT_STATUS_CHANGE) {
      const parsed = parseStatusChangeEvent(data);
      await BmeStatusChange.create({ height, ...parsed }, { transaction: dbTransaction });
    }
  }

  async afterEveryTransaction(
    _rawTx: DecodedTxRaw,
    currentTransaction: Transaction,
    dbTransaction: DbTransaction,
    txEvents: TransactionEvent[]
  ): Promise<void> {
    for (const event of txEvents) {
      if (event.type === BME_EVENT_TYPES.LEDGER_RECORD_EXECUTED || event.type === BME_EVENT_TYPES.MINT_STATUS_CHANGE) {
        const data = txEventToDataMap(event);
        await this.persistBmeEvent(event.type, data, currentTransaction.height, dbTransaction, this.txLevelSums);
      }
    }
  }

  @benchmark.measureMethodAsync
  async afterEveryBlock(currentBlock: Block, previousBlock: Block, dbTransaction: DbTransaction): Promise<void> {
    const rawEvents = await BmeRawEvent.findAll({
      where: { height: currentBlock.height, isProcessed: false },
      transaction: dbTransaction
    });

    let vaultAktFromEvent: number | null = null;
    const blockLevelSums = zeroBmeSums();
    const ledgerRecords: Array<Parameters<typeof BmeLedgerRecord.bulkCreate>[0][number]> = [];
    const statusChanges: Array<Parameters<typeof BmeStatusChange.bulkCreate>[0][number]> = [];

    for (const rawEvent of rawEvents) {
      if (rawEvent.type === BME_EVENT_TYPES.LEDGER_RECORD_EXECUTED) {
        const parsed = parseLedgerRecordEvent(rawEvent.data);
        ledgerRecords.push({ height: currentBlock.height, ...parsed });
        accumulateLedgerSums(blockLevelSums, parsed);
      } else if (rawEvent.type === BME_EVENT_TYPES.MINT_STATUS_CHANGE) {
        const parsed = parseStatusChangeEvent(rawEvent.data);
        statusChanges.push({ height: currentBlock.height, ...parsed });
      } else if (rawEvent.type === BME_EVENT_TYPES.VAULT_SEEDED) {
        const parsed = parseVaultSeededEvent(rawEvent.data);
        if (parsed.denom === "uakt") {
          vaultAktFromEvent = parseFloat(parsed.amount);
        }
      }
    }

    if (ledgerRecords.length > 0) {
      await BmeLedgerRecord.bulkCreate(ledgerRecords, { transaction: dbTransaction });
    }
    if (statusChanges.length > 0) {
      await BmeStatusChange.bulkCreate(statusChanges, { transaction: dbTransaction });
    }
    if (rawEvents.length > 0) {
      await BmeRawEvent.update({ isProcessed: true }, { where: { height: currentBlock.height, isProcessed: false }, transaction: dbTransaction });
    }

    // Combine tx-level and block-level sums
    const sums = this.txLevelSums;
    sums.aktBurned += blockLevelSums.aktBurned;
    sums.actMinted += blockLevelSums.actMinted;
    sums.actBurned += blockLevelSums.actBurned;
    sums.aktReminted += blockLevelSums.aktReminted;
    sums.creditIssued += blockLevelSums.creditIssued;
    sums.creditAccrued += blockLevelSums.creditAccrued;

    // Cumulative event-based counters (carry forward + current block delta)
    currentBlock.totalAktBurnedForAct = (previousBlock?.totalAktBurnedForAct || 0) + sums.aktBurned;
    currentBlock.totalActMinted = (previousBlock?.totalActMinted || 0) + sums.actMinted;
    currentBlock.totalActBurnedForAkt = (previousBlock?.totalActBurnedForAkt || 0) + sums.actBurned;
    currentBlock.totalAktReminted = (previousBlock?.totalAktReminted || 0) + sums.aktReminted;
    currentBlock.totalRemintCreditIssued = (previousBlock?.totalRemintCreditIssued || 0) + sums.creditIssued;
    currentBlock.totalRemintCreditAccrued = (previousBlock?.totalRemintCreditAccrued || 0) + sums.creditAccrued;

    // Absolute on-chain values
    if (vaultAktFromEvent !== null) {
      currentBlock.vaultAkt = (previousBlock?.vaultAkt || 0) + vaultAktFromEvent;
    } else {
      currentBlock.vaultAkt = previousBlock?.vaultAkt || null;
    }

    // Outstanding ACT = total minted - total burned back
    currentBlock.outstandingAct = currentBlock.totalActMinted - currentBlock.totalActBurnedForAkt;

    // Reset tx-level sums for next block
    this.txLevelSums = zeroBmeSums();
  }
}
