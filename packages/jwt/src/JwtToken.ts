import encode from "base64url";
import { createJWT } from "did-jwt";
import { ec as EC } from "elliptic";

import { JwtValidator } from "./JwtValidator/JwtValidator";
import type { CosmosWallet, JWK, JWTPayload } from "./types";

export interface JwtTokenOptions {
  iss: string;
  iat?: number;
  nbf?: number;
  exp?: number;
  jti?: string;
  version?: "v1";
  leases?: {
    access: "full" | "granular";
    scope?: Array<"send-manifest" | "get-manifest" | "logs" | "shell" | "events" | "status" | "restart" | "hostname-migrate" | "ip-migrate">;
    permissions?: Array<{
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
    const jwk = this.publicKeyToJWK(this.wallet.pubkey);
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
      iss: options.iss,
      iat: options.iat || now,
      nbf: options.nbf || now,
      exp: options.exp ? now + options.exp : now + 3600, // Default to 1 hour expiration
      jti: options.jti,
      version: options.version || "v1",
      leases: options.leases || { access: "full" }
    };

    // Validate payload and throw error with validation details if invalid
    const validationResult = this.validatePayload(payload);
    if (!validationResult) {
      throw new Error("Invalid payload");
    }

    // Sign the payload
    const signedJwt = await this.sign(payload, options.iss);

    // Add JWK to header
    const [header, payloadB64, signature] = signedJwt.split(".");
    const headerObj = JSON.parse(Buffer.from(header, "base64").toString());
    headerObj.jwk = jwk;
    const newHeader = encode(Buffer.from(JSON.stringify(headerObj)));

    return `${newHeader}.${payloadB64}.${signature}`;
  }

  /**
   * Signs a JWT payload using ES256K signature
   * @param payload - The JWT payload to sign
   * @param issuer - The issuer of the JWT
   * @returns The signed JWT token
   */
  async sign(payload: JWTPayload, issuer: string): Promise<string> {
    const signer = async (data: string | Uint8Array): Promise<string> => {
      const signResponse = await this.wallet.signArbitrary(this.wallet.address, typeof data === "string" ? data : new TextDecoder().decode(data));
      // Convert base64 signature to raw bytes then back to base64url without padding
      const signatureBytes = Buffer.from(signResponse.signature, "base64");
      return encode(signatureBytes);
    };

    return createJWT(payload, {
      issuer,
      signer,
      alg: "ES256K"
    });
  }

  /**
   * Decodes a JWT token
   * @param token - The JWT token to decode
   * @returns The decoded JWT payload
   * @throws Error if the token is malformed
   */
  decodeToken(token: string): JWTPayload {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    try {
      const [, payload] = parts;
      return JSON.parse(Buffer.from(payload, "base64url").toString());
    } catch (error) {
      throw new Error("Failed to decode JWT token");
    }
  }

  /**
   * Validates a JWT payload against the schema and time-based constraints
   * @param payload - The JWT payload to validate
   * @returns A boolean indicating whether the payload is valid
   */
  public async validatePayload(payload: JWTPayload): Promise<boolean> {
    const result = this.validator.validateToken(payload);
    if (!result.isValid) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);

    // Check expiration
    if (payload.exp && payload.exp <= now) {
      return false;
    }

    // Check not-before time
    if (payload.nbf && payload.nbf > now) {
      return false;
    }

    return true;
  }

  /**
   * Converts a raw public key to JWK format
   * @param pubKey - The raw public key as Uint8Array
   * @returns The public key in JWK format
   */
  private publicKeyToJWK(pubKey: Uint8Array): JWK {
    // Convert pubKey to hex string
    const pubKeyHex = Buffer.from(pubKey).toString("hex");
    const keyPair = this.ec.keyFromPublic(pubKeyHex, "hex");
    const pub = keyPair.getPublic();

    return {
      kty: "EC",
      crv: "secp256k1",
      x: encode(Buffer.from(pub.getX().toArray())),
      y: encode(Buffer.from(pub.getY().toArray()))
    };
  }
}
