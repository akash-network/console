import encode from "base64url";
import { createJWT } from "did-jwt";
import { ec as EC } from "elliptic";

import { JwtValidator } from "./JwtValidator/JwtValidator";
import type { CosmosWallet, JWTPayload } from "./types";
import { WalletUtils } from "./wallet";

export interface JwtTokenOptions {
  iss: string;
  iat?: number;
  nbf?: number;
  exp?: number;
  jti?: string;
  version?: "v1";
  leases?: {
    access: "full" | "granular";
    permissions?: Array<{
      provider: string;
      scope: Array<"send-manifest" | "shell" | "logs" | "events" | "restart">;
      dseq?: number;
      gseq?: number;
      oseq?: number;
      services?: Array<string>;
    }>;
  };
}

export class JwtToken {
  private validator: JwtValidator;
  private wallet: CosmosWallet;
  private chainId: string;
  private ec: EC;

  constructor(wallet: CosmosWallet, chainId: string = "akashnet-2") {
    this.validator = new JwtValidator();
    this.wallet = wallet;
    this.chainId = chainId;
    this.ec = new EC("secp256k1");
  }

  /**
   * Creates a new JWT token with ES256K signature using a Cosmos SDK wallet
   * @param options - JWT token options
   * @returns The signed JWT token
   */
  async createToken(options: JwtTokenOptions): Promise<string> {
    // Create JWK from public key
    const jwk = WalletUtils.publicKeyToJWK(this.wallet.pubkey);

    // Create payload
    const payload: JWTPayload = {
      iss: options.iss,
      iat: options.iat || Math.floor(Date.now() / 1000),
      nbf: options.nbf || Math.floor(Date.now() / 1000),
      exp: options.exp ? Math.floor(Date.now() / 1000) + options.exp : undefined,
      jti: options.jti,
      version: options.version || "v1",
      leases: options.leases || { access: "full" }
    };

    // Create signer function
    const signer = async (data: string | Uint8Array): Promise<string> => {
      const signResponse = await this.wallet.signArbitrary(this.wallet.address, typeof data === "string" ? data : new TextDecoder().decode(data));
      return signResponse.signature.replace(/=/g, "");
    };

    // Create JWT with ES256K using did-jwt
    const jwt = await createJWT(payload, {
      issuer: options.iss,
      signer,
      alg: "ES256K"
    });

    // Add JWK to header
    const [header, payloadB64, signature] = jwt.split(".");
    const headerObj = JSON.parse(Buffer.from(header, "base64").toString());
    headerObj.jwk = jwk;
    const newHeader = encode(Buffer.from(JSON.stringify(headerObj)));

    return `${newHeader}.${payloadB64}.${signature}`;
  }

  /**
   * Decodes a JWT token
   * @param token - The JWT token to decode
   * @returns The decoded JWT payload
   */
  decodeToken(token: string): JWTPayload {
    const [, payload] = token.split(".");
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  }

  /**
   * Validates a JWT payload against the schema
   * @param payload - The JWT payload to validate
   * @returns True if the payload is valid, false otherwise
   */
  validatePayload(payload: JWTPayload): boolean {
    const token = this.createUnsignedToken(payload);
    const result = this.validator.validateToken(token);
    console.log("Validation errors:", result.errors);
    return result.isValid;
  }

  private createUnsignedToken(payload: JWTPayload): string {
    const header = {
      alg: "ES256K",
      typ: "JWT"
    };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encodedHeader}.${encodedPayload}.dummy-signature`;
  }
}
