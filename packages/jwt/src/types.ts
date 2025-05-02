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

/**
 * JSON Web Key format for EC keys
 */
export interface JWK {
  kty: string;
  crv: string;
  x: string;
  y: string;
}

export interface JWTHeader {
  alg: string;
  typ: string;
}

export interface JWTPayload {
  iss: string;
  sub?: string;
  aud?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  version?: string;
  leases?: {
    access: "full" | "granular";
    permissions?: Array<{
      provider: string;
      scope: Array<string>;
      dseq?: number;
      gseq?: number;
      oseq?: number;
      services?: Array<string>;
    }>;
  };
}
