import type { StdSignature } from "@cosmjs/amino";

/**
 * Generic interface for Cosmos SDK wallets
 */
export interface CosmosWallet {
  pubkey: Uint8Array;
  address: string;

  /**
   * Sign arbitrary data
   * @param chainId - The chain ID to sign for
   * @param address - The address to sign with
   * @param data - The data to sign
   */
  signArbitrary: (signer: string, data: string | Uint8Array) => Promise<StdSignature>;
}

export interface JWTHeader {
  alg: string;
  typ: string;
}

export interface Permission {
  provider: string;
  access: "full" | "scoped" | "granular";
  scope?: Array<"send-manifest" | "get-manifest" | "logs" | "shell" | "events" | "status" | "restart" | "hostname-migrate" | "ip-migrate">;
  deployments?: Array<{
    dseq: number;
    scope: Array<"send-manifest" | "get-manifest" | "logs" | "shell" | "events" | "status" | "restart" | "hostname-migrate" | "ip-migrate">;
    gseq?: number;
    oseq?: number;
    services?: Array<string>;
  }>;
}

export interface Leases {
  access: "full" | "granular" | "scoped";
  scope?: Array<"send-manifest" | "get-manifest" | "logs" | "shell" | "events" | "status" | "restart" | "hostname-migrate" | "ip-migrate">;
  permissions?: Permission[];
}

export interface JWTPayload {
  iss: string;
  iat?: number;
  nbf?: number;
  exp?: number;
  jti?: string;
  version?: "v1";
  leases: Leases;
}
