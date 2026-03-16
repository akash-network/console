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
 * Strip JSON string encoding from proto event attribute values.
 * CometBFT ABCI 2.0+ JSON-encodes string/Dec attributes, e.g. `"bme"` or `"22314182.50..."`.
 * Falls back to the raw value if it's not JSON-quoted.
 */
function parseStringAttr(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value;
    }
  }
  return value;
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
    sequence: id?.sequence != null ? Number(id.sequence) : null,
    burnedFrom: parseStringAttr(data.burned_from) || "",
    mintedTo: parseStringAttr(data.minted_to) || "",
    burner: parseStringAttr(data.burner) || null,
    minter: parseStringAttr(data.minter) || null,
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
    previousStatus: parseStringAttr(data.previous_status) || "",
    newStatus: parseStringAttr(data.new_status) || "",
    collateralRatio: parseStringAttr(data.collateral_ratio) || "0"
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

interface BmeSums {
  /** AKT consumed to mint ACT — from remint_credit_accrued (AKT goes to vault, not burned) */
  aktBurnedForAct: number;
  /** ACT newly minted — from minted.coin when denom is uact */
  actMinted: number;
  /** ACT burned to remint AKT — from burned.coin when denom is uact */
  actBurnedForAkt: number;
  /** AKT returned from vault — from remint_credit_issued (AKT comes from vault, not minted) */
  aktReminted: number;
}

function accumulateLedgerSums(sums: BmeSums, parsed: ParsedLedgerRecord): void {
  // Mint operation (uakt→uact): AKT goes to vault via remint_credit_accrued, ACT is minted
  if (parsed.remintCreditAccruedAmount) sums.aktBurnedForAct += parseFloat(parsed.remintCreditAccruedAmount);
  if (parsed.mintedDenom === "uact") sums.actMinted += parseFloat(parsed.mintedAmount);

  // Burn operation (uact→uakt): ACT is burned, AKT comes from vault via remint_credit_issued
  if (parsed.burnedDenom === "uact") sums.actBurnedForAkt += parseFloat(parsed.burnedAmount);
  if (parsed.remintCreditIssuedAmount) sums.aktReminted += parseFloat(parsed.remintCreditIssuedAmount);
}

function zeroBmeSums(): BmeSums {
  return { aktBurnedForAct: 0, actMinted: 0, actBurnedForAkt: 0, aktReminted: 0 };
}

export { BME_EVENT_TYPE_VALUES };

export class BmeIndexer extends Indexer {
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

  // BME events only appear in end_block_events, never in transaction events
  async afterEveryTransaction(
    _rawTx: DecodedTxRaw,
    _currentTransaction: Transaction,
    _dbTransaction: DbTransaction,
    _txEvents: TransactionEvent[]
  ): Promise<void> {}

  @benchmark.measureMethodAsync
  async afterEveryBlock(currentBlock: Block, previousBlock: Block, dbTransaction: DbTransaction): Promise<void> {
    const rawEvents = await BmeRawEvent.findAll({
      where: { height: currentBlock.height, isProcessed: false },
      transaction: dbTransaction
    });

    let vaultUaktFromEvent: number | null = null;
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
          vaultUaktFromEvent = parseFloat(parsed.newVaultBalance.amount);
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

    const sums = blockLevelSums;

    // Cumulative event-based counters (carry forward + current block delta)
    currentBlock.totalUaktBurnedForUact = (previousBlock?.totalUaktBurnedForUact || 0) + sums.aktBurnedForAct;
    currentBlock.totalUactMinted = (previousBlock?.totalUactMinted || 0) + sums.actMinted;
    currentBlock.totalUactBurnedForUakt = (previousBlock?.totalUactBurnedForUakt || 0) + sums.actBurnedForAkt;
    currentBlock.totalUaktReminted = (previousBlock?.totalUaktReminted || 0) + sums.aktReminted;
    currentBlock.totalRemintCreditIssued = (previousBlock?.totalRemintCreditIssued || 0) + sums.aktReminted;
    currentBlock.totalRemintCreditAccrued = (previousBlock?.totalRemintCreditAccrued || 0) + sums.aktBurnedForAct;

    // Vault uAKT = AKT deposited via mints minus AKT withdrawn via burns, plus any governance seed
    if (vaultUaktFromEvent !== null) {
      // EventVaultSeeded provides an absolute snapshot of vault balance
      currentBlock.vaultUakt = vaultUaktFromEvent;
    } else {
      // Compute from flows: AKT in (mints) minus AKT out (remints)
      currentBlock.vaultUakt = currentBlock.totalUaktBurnedForUact - currentBlock.totalUaktReminted;
    }

    // Outstanding uACT = total minted - total burned back - spent on deployments
    currentBlock.outstandingUact = currentBlock.totalUactMinted - currentBlock.totalUactBurnedForUakt - (currentBlock.totalUActSpent || 0);
  }
}
