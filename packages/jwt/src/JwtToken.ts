import { createJWT } from "did-jwt";
import { ec as EC } from "elliptic";

import { JwtValidator } from "./JwtValidator/JwtValidator";
import type { CosmosWallet, JWTPayload } from "./types";

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
    const now = Math.floor(Date.now() / 1000);
    const inputPayload: JWTPayload = {
      iss: options.iss,
      exp: options.exp ? options.exp : now + 3600, // Default to 1 hour expiration
      iat: options.iat,
      nbf: options.nbf,
      jti: options.jti,
      version: options.version || "v1",
      leases: options.leases || { access: "full" }
    };

    // Validate payload and throw error with validation details if invalid
    const validationResult = this.validatePayload(inputPayload);
    if (!validationResult) {
      throw new Error("Invalid payload");
    }

    // Manually create base64url encoded payload
    const stringPayload = Buffer.from(JSON.stringify(inputPayload)).toString("base64url");

    const signedJwt = await this.createJWT(inputPayload, options.iss);
    const [header, , signature] = signedJwt.split(".");

    const reorderedJWT = `${header}.${stringPayload}.${signature}`;

    return reorderedJWT;
  }

  /**
   * Created a signed JWT token from using ES256K signature
   * @param payload - The JWT payload to sign
   * @param issuer - The issuer of the JWT
   * @returns The signed JWT token
   */
  async createJWT(payload: JWTPayload, issuer: string): Promise<string> {
    const signer = async (data: string | Uint8Array): Promise<string> => {
      const input = typeof data === "string" ? data : new TextDecoder().decode(data);

      // Split the JWT into parts
      const [header, payloadPart] = input.split(".");

      // Parse and reorder the payload
      const parsedPayload = JSON.parse(Buffer.from(payloadPart, "base64url").toString());
      const reorderedPayload = {
        ...(parsedPayload.iss && { iss: parsedPayload.iss }),
        ...(parsedPayload.exp && { exp: parsedPayload.exp }),
        ...(parsedPayload.iat && { iat: parsedPayload.iat }),
        ...(parsedPayload.nbf && { nbf: parsedPayload.nbf }),
        ...(parsedPayload.jti && { jti: parsedPayload.jti }),
        ...(parsedPayload.version && { version: parsedPayload.version }),
        ...(parsedPayload.leases && { leases: parsedPayload.leases })
      };

      // Reconstruct the JWT with reordered payload
      const reorderedJWT = `${header}.${Buffer.from(JSON.stringify(reorderedPayload)).toString("base64url")}`;

      const signResponse = await this.wallet.signArbitrary(this.wallet.address, reorderedJWT);
      return signResponse.signature;
    };

    return createJWT(
      payload,
      {
        issuer,
        signer,
        alg: "ES256K"
      },
      {
        alg: "ES256K",
        typ: "JWT"
      }
    );
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
}
