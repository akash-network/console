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

/**
 * Matches the proto CoinPrice message:
 *   message CoinPrice { Coin coin = 1; string price = 2; }
 * where Coin is { string denom; string amount; }
 */
interface CoinPrice {
  coin: { denom: string; amount: string };
  price: string;
}

/**
 * Matches the proto LedgerRecordID message
 */
interface LedgerRecordID {
  denom: string;
  to_denom: string;
  source: string;
  height: number;
  sequence: number;
}

interface ParsedLedgerRecord {
  sequence: number | null;
  burnedFrom: string;
  mintedTo: string;
  burner: string | null;
  minter: string | null;
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
  newVaultBalance: { amount: string; denom: string } | null;
}

function parseJsonValue<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Parse a CoinPrice proto attribute.
 * Event attribute is JSON: {"coin":{"denom":"uakt","amount":"1000"},"price":"1.23"}
 */
function parseCoinPrice(value: string | null | undefined): CoinPrice | null {
  const parsed = parseJsonValue<CoinPrice>(value);
  if (!parsed?.coin) return null;
  return parsed;
}

/**
 * Parse EventLedgerRecordExecuted attributes.
 *
 * Proto fields (from akash.bme.v1.EventLedgerRecordExecuted):
 *   id (LedgerRecordID), burned_from, minted_to, burner, minter,
 *   burned (CoinPrice), minted (CoinPrice),
 *   remint_credit_issued (CoinPrice), remint_credit_accrued (CoinPrice)
 */
function parseLedgerRecordEvent(data: Record<string, string | null>): ParsedLedgerRecord {
  const id = parseJsonValue<LedgerRecordID>(data.id);
  const burned = parseCoinPrice(data.burned);
  const minted = parseCoinPrice(data.minted);
  const remintCreditIssued = parseCoinPrice(data.remint_credit_issued);
  const remintCreditAccrued = parseCoinPrice(data.remint_credit_accrued);

  return {
    sequence: id?.sequence ?? null,
    burnedFrom: data.burned_from || "",
    mintedTo: data.minted_to || "",
    burner: data.burner || null,
    minter: data.minter || null,
    burnedDenom: burned?.coin.denom || "",
    burnedAmount: burned?.coin.amount || "0",
    burnedPrice: burned?.price || null,
    mintedDenom: minted?.coin.denom || "",
    mintedAmount: minted?.coin.amount || "0",
    mintedPrice: minted?.price || null,
    remintCreditIssuedAmount: remintCreditIssued?.coin.amount || null,
    remintCreditAccruedAmount: remintCreditAccrued?.coin.amount || null
  };
}

/**
 * Parse EventMintStatusChange attributes.
 *
 * Proto fields: previous_status (MintStatus enum), new_status (MintStatus enum), collateral_ratio (Dec)
 */
function parseStatusChangeEvent(data: Record<string, string | null>): ParsedStatusChange {
  return {
    previousStatus: data.previous_status || "",
    newStatus: data.new_status || "",
    collateralRatio: data.collateral_ratio || "0"
  };
}

/**
 * Parse EventVaultSeeded attributes.
 *
 * Proto fields: amount (Coin), source (string), new_vault_balance (Coin)
 */
function parseVaultSeededEvent(data: Record<string, string | null>): ParsedVaultSeeded {
  const amount = parseJsonValue<{ amount: string; denom: string }>(data.amount);
  const newVaultBalance = parseJsonValue<{ amount: string; denom: string }>(data.new_vault_balance);

  return {
    amount: amount?.amount || "0",
    denom: amount?.denom || "uakt",
    newVaultBalance
  };
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
        if (parsed.newVaultBalance && parsed.newVaultBalance.denom === "uakt") {
          vaultAktFromEvent = parseFloat(parsed.newVaultBalance.amount);
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

    // Absolute on-chain vault balance from EventVaultSeeded.new_vault_balance
    if (vaultAktFromEvent !== null) {
      currentBlock.vaultAkt = vaultAktFromEvent;
    } else {
      currentBlock.vaultAkt = previousBlock?.vaultAkt || null;
    }

    // Outstanding ACT = total minted - total burned back
    currentBlock.outstandingAct = currentBlock.totalActMinted - currentBlock.totalActBurnedForAkt;

    // Reset tx-level sums for next block
    this.txLevelSums = zeroBmeSums();
  }
}
