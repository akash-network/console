import { createJWT } from "did-jwt";
import { ec as EC } from "elliptic";

import { JwtValidator } from "./JwtValidator/JwtValidator";
import type { CosmosWallet, JWTPayload } from "./types";
import { WalletUtils } from "./wallet";

export interface JwtTokenOptions {
  issuer: string;
  subject: string;
  audience: string;
  expiresIn?: number;
  notBefore?: number;
  issuedAt?: number;
  jwtId?: string;
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
    // Connect to wallet and get key
    await this.wallet.enable(this.chainId);
    const { bech32Address, pubKey } = await this.wallet.getKey(this.chainId);

    // Create JWK from public key
    const jwk = WalletUtils.publicKeyToJWK(pubKey);

    // Create payload
    const payload: JWTPayload = {
      iss: options.issuer,
      sub: options.subject,
      aud: options.audience,
      exp: options.expiresIn ? Math.floor(Date.now() / 1000) + options.expiresIn : undefined,
      nbf: options.notBefore || Math.floor(Date.now() / 1000),
      iat: options.issuedAt || Math.floor(Date.now() / 1000),
      jti: options.jwtId,
      version: options.version || "v1",
      leases: options.leases || { access: "full" }
    };

    // Create signer function
    const signer = async (data: string | Uint8Array): Promise<string> => {
      const signResponse = await this.wallet.signArbitrary(this.chainId, bech32Address, typeof data === "string" ? data : new TextDecoder().decode(data));
      return WalletUtils.signatureToBase64url(signResponse.signature);
    };

    // Create JWT with ES256K using did-jwt
    const jwt = await createJWT(payload, {
      issuer: options.issuer,
      signer,
      alg: "ES256K"
    });

    // Add JWK to header
    const [header, payloadB64, signature] = jwt.split(".");
    const headerObj = JSON.parse(Buffer.from(header, "base64url").toString());
    headerObj.jwk = jwk;
    const newHeader = Buffer.from(JSON.stringify(headerObj)).toString("base64url");

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
