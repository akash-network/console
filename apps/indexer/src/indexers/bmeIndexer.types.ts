/**
 * Matches the proto CoinPrice message:
 *   message CoinPrice { Coin coin = 1; string price = 2; }
 * where Coin is { string denom; string amount; }
 */
export interface CoinPrice {
  coin: { denom: string; amount: string };
  price: string;
}

/**
 * Matches the proto LedgerRecordID message
 */
export interface LedgerRecordID {
  denom: string;
  to_denom: string;
  source: string;
  height: number;
  sequence: number;
}

export interface ParsedLedgerRecord {
  sequence: number | null;
  burnedFrom: string;
  mintedTo: string;
  burnedDenom: string | null;
  burnedAmount: string;
  burnedPrice: string | null;
  mintedDenom: string | null;
  mintedAmount: string;
  mintedPrice: string | null;
  remintCreditIssuedAmount: string | null;
  remintCreditAccruedAmount: string | null;
}

export interface ParsedStatusChange {
  previousStatus: string;
  newStatus: string;
  collateralRatio: string;
}

export interface ParsedVaultSeeded {
  amount: string;
  denom: string;
  newVaultBalance: { amount: string; denom: string } | null;
}

export interface ParsedPriceData {
  source: string;
  denom: string;
  baseDenom: string;
  price: string;
  timestamp: string | null;
}

export interface BmeSums {
  /** AKT consumed to mint ACT — from remint_credit_accrued (AKT goes to vault, not burned) */
  aktBurnedForAct: number;
  /** ACT newly minted — from minted.coin when denom is uact */
  actMinted: number;
  /** ACT burned to remint AKT — from burned.coin when denom is uact */
  actBurnedForAkt: number;
  /** AKT returned from vault — from remint_credit_issued (AKT comes from vault, not minted) */
  aktReminted: number;
}
