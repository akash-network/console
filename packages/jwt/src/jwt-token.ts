import { JwtValidator } from "./jwt-validator";
import type { JWTPayload, JwtTokenOptions } from "./types";
import type { SignArbitraryAkashWallet } from "./wallet-utils";

// Helper function for base64url encoding
function base64UrlEncode(str: string): string {
  // First encode to base64
  const base64 = btoa(str);
  // Then convert to base64url format
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export class JwtToken {
  private validator: JwtValidator;
  private wallet: SignArbitraryAkashWallet;

  constructor(wallet: SignArbitraryAkashWallet) {
    this.validator = new JwtValidator();
    this.wallet = wallet;
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

    const validationResult = this.validatePayload(inputPayload);
    if (!validationResult) {
      throw new Error("Invalid payload");
    }

    const header = base64UrlEncode(JSON.stringify({ alg: "ES256K", typ: "JWT" }));
    const stringPayload = base64UrlEncode(JSON.stringify(inputPayload));
    const { signature } = await this.wallet.signArbitrary(this.wallet.address, `${header}.${stringPayload}`);

    const reorderedJWT = `${header}.${stringPayload}.${signature}`;

    return reorderedJWT;
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
      // Convert base64url to base64 and decode
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
      return JSON.parse(atob(padded));
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
