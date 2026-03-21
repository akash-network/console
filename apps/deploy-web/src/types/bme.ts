/** Response from /akash/bme/v1/params */
export interface RpcBmeParams {
  params: {
    min_mint: { denom: string; amount: string };
    mint_spread_bps: number;
    settle_spread_bps: number;
  };
}

/** Response from /akash/bme/v1/status */
export interface RpcBmeStatus {
  status: {
    mints_allowed: boolean;
    refunds_allowed: boolean;
    collateral_ratio: string;
    circuit_breaker_warn_threshold: string;
  };
}

/** Parsed BME params for consumer use */
export interface BmeParams {
  minMintUact: number;
  minMintAct: number;
  mintSpreadBps: number;
  settleSpreadBps: number;
}

/** Parsed BME status for consumer use */
export interface BmeStatus {
  mintsAllowed: boolean;
  refundsAllowed: boolean;
  collateralRatio: number;
  circuitBreakerWarnThreshold: number;
}
