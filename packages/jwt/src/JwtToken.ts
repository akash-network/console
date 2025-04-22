import base64url from "base64url";

import { JwtValidator } from "./JwtValidator/JwtValidator.js";
import type { CosmosWallet, JWK, JWTHeader, JWTPayload } from "./types.js";
import { WalletUtils } from "./wallet.js";

export interface JwtTokenOptions {
  issuer: string;
  subject: string;
  audience: string;
  expiresIn?: number;
  notBefore?: number;
  issuedAt?: number;
  jwtId?: string;
}

export class JwtToken {
  private validator: JwtValidator;
  private wallet: CosmosWallet;
  private chainId: string;

  constructor(wallet: CosmosWallet, chainId: string = "akashnet-2") {
    this.validator = new JwtValidator();
    this.wallet = wallet;
    this.chainId = chainId;
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

    // Create header with algorithm and JWK
    const header: JWTHeader & { jwk: JWK } = {
      alg: "ES256K",
      typ: "JWT",
      jwk
    };

    // Create payload
    const payload: JWTPayload = {
      iss: options.issuer,
      sub: options.subject,
      aud: options.audience,
      exp: options.expiresIn ? Math.floor(Date.now() / 1000) + options.expiresIn : undefined,
      nbf: options.notBefore,
      iat: options.issuedAt || Math.floor(Date.now() / 1000),
      jti: options.jwtId
    };

    // Encode header and payload
    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    const unsignedJWT = `${encodedHeader}.${encodedPayload}`;

    // Sign the JWT
    const { signature } = await this.wallet.signArbitrary(this.chainId, bech32Address, unsignedJWT);
    const encodedSignature = WalletUtils.signatureToBase64url(signature);

    // Return complete JWT
    return `${unsignedJWT}.${encodedSignature}`;
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
    return result.isValid;
  }

  private createUnsignedToken(payload: JWTPayload): string {
    const header = {
      alg: "ES256K",
      typ: "JWT"
    };
    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    return `${encodedHeader}.${encodedPayload}.dummy-signature`;
  }
}
