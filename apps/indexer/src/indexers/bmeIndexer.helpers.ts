import type { BmeSums, CoinPrice, LedgerRecordID, ParsedLedgerRecord, ParsedStatusChange, ParsedVaultSeeded } from "./bmeIndexer.types";

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

export function safeParseFloat(value: string): number {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Parse EventLedgerRecordExecuted attributes.
 *
 * Proto fields (from akash.bme.v1.EventLedgerRecordExecuted):
 *   id (LedgerRecordID), burned_from, minted_to, burner, minter,
 *   burned (CoinPrice), minted (CoinPrice),
 *   remint_credit_issued (CoinPrice), remint_credit_accrued (CoinPrice)
 */
export function parseLedgerRecordEvent(data: Record<string, string | null>): ParsedLedgerRecord {
  const id = parseJsonValue<LedgerRecordID>(data.id);
  const burned = parseCoinPrice(data.burned);
  const minted = parseCoinPrice(data.minted);
  const remintCreditIssued = parseCoinPrice(data.remint_credit_issued);
  const remintCreditAccrued = parseCoinPrice(data.remint_credit_accrued);

  return {
    sequence: id?.sequence != null ? Number(id.sequence) : null,
    burnedFrom: parseStringAttr(data.burned_from) || "",
    mintedTo: parseStringAttr(data.minted_to) || "",
    burnedDenom: burned?.coin.denom || null,
    burnedAmount: burned?.coin.amount || "0",
    burnedPrice: burned?.price || null,
    mintedDenom: minted?.coin.denom || null,
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
export function parseStatusChangeEvent(data: Record<string, string | null>): ParsedStatusChange {
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
export function parseVaultSeededEvent(data: Record<string, string | null>): ParsedVaultSeeded {
  const amount = parseJsonValue<{ amount: string; denom: string }>(data.amount);
  const newVaultBalance = parseJsonValue<{ amount: string; denom: string }>(data.new_vault_balance);

  return {
    amount: amount?.amount || "0",
    denom: amount?.denom || "uakt",
    newVaultBalance
  };
}

export function accumulateLedgerSums(sums: BmeSums, parsed: ParsedLedgerRecord): void {
  // Mint operation (uakt→uact): AKT goes to vault via remint_credit_accrued, ACT is minted
  if (parsed.remintCreditAccruedAmount) sums.aktBurnedForAct += safeParseFloat(parsed.remintCreditAccruedAmount);
  if (parsed.mintedDenom === "uact") sums.actMinted += safeParseFloat(parsed.mintedAmount);

  // Burn operation (uact→uakt): ACT is burned, AKT comes from vault via remint_credit_issued
  if (parsed.burnedDenom === "uact") sums.actBurnedForAkt += safeParseFloat(parsed.burnedAmount);
  if (parsed.remintCreditIssuedAmount) sums.aktReminted += safeParseFloat(parsed.remintCreditIssuedAmount);
}

export function zeroBmeSums(): BmeSums {
  return { aktBurnedForAct: 0, actMinted: 0, actBurnedForAkt: 0, aktReminted: 0 };
}
