import { base64UrlEncode } from "./base64";
import { JwtValidator } from "./jwt-validator";
import type { JWTPayload, JwtTokenOptions } from "./types";
import type { SignArbitraryAkashWallet } from "./wallet-utils";

export class JwtToken {
  private validator: JwtValidator;
  private wallet: SignArbitraryAkashWallet;

  constructor(wallet: SignArbitraryAkashWallet) {
    this.validator = new JwtValidator();
    this.wallet = wallet;
  }

  /**
   * Creates a new JWT token with ES256K signature using a custom signArbitrary method with the current wallet
   * @param options - JWT token options
   * @returns The signed JWT token
   * @example
   * const wallet = await DirectSecp256k1HdWallet.fromMnemonic(jwtMnemonic, {
   *   prefix: "akash"
   * });
   * const akashWallet = await createSignArbitraryAkashWallet(wallet);
   * const jwtToken = new JwtToken(akashWallet);
   * // OR ON FRONTEND
   * const { getAccount, signArbitrary } = useSelectedChain();
   * const { address, pubkey } = await getAccount();
   * const jwt = new JwtToken(
   *   {
   *     signArbitrary,
   *     address,
   *     pubkey
   *   }
   * );
   * const token = await jwtToken.createToken({
   *   iss: "https://example.com",
   *   exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
   *   iat: Math.floor(Date.now() / 1000), // current timestamp
   * });
   * console.log(token);
   */
  async createToken(options: JwtTokenOptions): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const inputPayload: JWTPayload = {
      iss: options.iss,
      exp: options.exp ? options.exp : now + 3600, // Default to 1 hour expiration
      nbf: options.nbf,
      iat: options.iat,
      jti: options.jti,
      version: options.version || "v1",
      leases: options.leases || { access: "full" }
    };

    const validationResult = await this.validatePayload(inputPayload);
    if (!validationResult.isValid) {
      throw new Error(`Invalid payload: ${validationResult.errors?.join(", ")}`);
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
      const json = Buffer.from(payload, "base64url").toString("utf8");
      return JSON.parse(json);
    } catch (error) {
      throw new Error("Failed to decode JWT token");
    }
  }

  /**
   * Validates a JWT payload against the schema and time-based constraints
   * @param payload - The JWT payload to validate
   * @returns A boolean indicating whether the payload is valid
   */
  public async validatePayload(payload: JWTPayload): Promise<{ isValid: boolean; errors?: string[] }> {
    const result = this.validator.validateToken(payload);
    if (!result.isValid) {
      return { isValid: false, errors: result.errors };
    }

    const now = Math.floor(Date.now() / 1000);
    const errors: string[] = [];

    // Check expiration
    if (payload.exp && payload.exp <= now) {
      errors.push("Token has expired");
    }

    // Check not-before time
    if (payload.nbf && payload.nbf > now) {
      errors.push("Token is not yet valid (nbf check failed)");
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}
