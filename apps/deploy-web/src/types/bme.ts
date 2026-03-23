/** Response from /akash/bme/v1/params */
export interface RpcBmeParams {
  params: {
    min_mint: { denom: string; amount: string };
  };
}

/** Parsed BME params for consumer use */
export interface BmeParams {
  minMintUact: number;
  minMintAct: number;
}
