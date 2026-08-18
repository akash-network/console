import { asString, parseJsonRecord } from "@src/akash/json";
import { isDecString } from "@src/bme/bme-deriver";
import type { DecodedBlock, DecodedEvent } from "@src/pipeline/decoded-block";

/** Every native BME event type; only the chain's BME module emits under this prefix, and only from the upgrade block on. */
const NATIVE_BME_EVENT_PREFIX = "akash.bme.v1.";
const LEDGER_RECORD_EXECUTED_EVENT_TYPE = "akash.bme.v1.EventLedgerRecordExecuted";
const PRICE_DATA_EVENT_TYPE = "akash.oracle.v1.EventPriceData";

/** The x/bme module account — the burner/minter of every denom conversion — identical on every network. */
export const BME_MODULE_ADDRESS = "akash1klpwzlvfnw7j8gtdd0cuu9vaw9ermsmd37sg55";

/** The axlUSDC IBC denoms the upgrade converted at par, hardcoded the same way in the chain's migration. */
export const IBC_USDC_DENOMS: readonly string[] = [
  "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1",
  "ibc/028CD1864059EEFB48A6048376165318E3E82C234390AE5A6D7B22001725B06E"
];

/**
 * The bank movements of this block's denom conversions: what the BME module account burned and
 * minted. Regular BME ledger executions burn and mint through the same account, so the totals only
 * bind the conversion boundary when the block carries no `EventLedgerRecordExecuted`.
 */
export interface ActConversionBankTotals {
  burnedUakt: bigint;
  burnedUsdc: bigint;
  mintedUact: bigint;
}

export interface ActMigrationSignals {
  hasNativeBmeEvent: boolean;
  lastAktUsdPrice: string | null;
  bankTotals: ActConversionBankTotals;
  hasLedgerExecutedEvent: boolean;
}

/**
 * The BME upgrade converted every open escrow account in place without per-account events, so the
 * conversion must be inferred from block content: the first native BME event marks the upgrade
 * block, the BME module's burn/coinbase totals mark each drain block and how much it converted, and
 * oracle `EventPriceData` supplies the drain rate. Oracle prices arrive via wasm transactions, so
 * failed transactions are skipped; the conversion's bank events fire in the EndBlocker and are
 * scanned there too.
 */
export function deriveActMigrationSignals(block: DecodedBlock): ActMigrationSignals {
  const signals: ActMigrationSignals = {
    hasNativeBmeEvent: false,
    lastAktUsdPrice: null,
    bankTotals: { burnedUakt: 0n, burnedUsdc: 0n, mintedUact: 0n },
    hasLedgerExecutedEvent: false
  };

  for (const tx of block.transactions) {
    if (tx.code !== 0) {
      continue;
    }
    scanEvents(tx.events, signals);
  }
  scanEvents(block.blockEvents, signals);

  return signals;
}

function scanEvents(events: DecodedEvent[], signals: ActMigrationSignals): void {
  for (const event of events) {
    if (event.type.startsWith(NATIVE_BME_EVENT_PREFIX)) {
      signals.hasNativeBmeEvent = true;
      if (event.type === LEDGER_RECORD_EXECUTED_EVENT_TYPE) {
        signals.hasLedgerExecutedEvent = true;
      }
    } else if (event.type === PRICE_DATA_EVENT_TYPE) {
      const price = aktUsdPriceOf(event.attributes);
      if (price !== null) {
        signals.lastAktUsdPrice = price;
      }
    } else if (event.type === "burn" && event.attributes.burner === BME_MODULE_ADDRESS) {
      const coin = parseCoinString(event.attributes.amount);
      if (coin?.denom === "uakt") {
        signals.bankTotals.burnedUakt += coin.amount;
      } else if (coin && IBC_USDC_DENOMS.includes(coin.denom)) {
        signals.bankTotals.burnedUsdc += coin.amount;
      }
    } else if (event.type === "coinbase" && event.attributes.minter === BME_MODULE_ADDRESS) {
      const coin = parseCoinString(event.attributes.amount);
      if (coin?.denom === "uact") {
        signals.bankTotals.mintedUact += coin.amount;
      }
    }
  }
}

function aktUsdPriceOf(attributes: Record<string, string>): string | null {
  const id = parseJsonRecord(attributes.id);
  const denom = asString(id?.denom);
  const baseDenom = asString(id?.base_denom);
  if ((denom !== "uakt" && denom !== "akt") || baseDenom !== "usd") {
    return null;
  }
  const data = parseJsonRecord(attributes.data);
  const price = asString(data?.price);
  return price !== null && isDecString(price) ? price : null;
}

function parseCoinString(raw: string | undefined): { amount: bigint; denom: string } | null {
  const match = raw === undefined ? null : /^(\d+)(.+)$/.exec(raw);
  return match ? { amount: BigInt(match[1]), denom: match[2] } : null;
}
