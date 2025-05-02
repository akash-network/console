/**
 * Generic interface for Cosmos SDK wallets
 */
export interface CosmosWallet {
  /**
   * Enable/connect to the wallet for a specific chain
   * @param chainId - The chain ID to connect to
   */
  enable(chainId: string): Promise<void>;

  /**
   * Get the user's address and public key
   * @param chainId - The chain ID to get the key for
   */
  getKey(chainId: string): Promise<{
    bech32Address: string;
    pubKey: Uint8Array;
  }>;

  /**
   * Sign arbitrary data
   * @param chainId - The chain ID to sign for
   * @param address - The address to sign with
   * @param data - The data to sign
   */
  signArbitrary(
    chainId: string,
    address: string,
    data: string
  ): Promise<{
    signature: Uint8Array;
  }>;
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
