import type { StdSignature } from "@cosmjs/amino";
import type { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

import type { jwtClaimsTestCases } from "../generated/jwtClaimsTestCases";
import type { JWTPayload } from "../types";

/**
 * Generates Akash addresses for testing purposes
 */
export class AkashAddressSeeder {
  private static readonly PREFIX = "akash1";
  private static readonly ADDRESS_LENGTH = 38; // 38 chars after akash1 prefix

  /**
   * Creates a random Akash address
   * @returns A random Akash address string
   */
  static create(): string {
    const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
    const randomChars = Array.from({ length: this.ADDRESS_LENGTH }, () => chars.charAt(Math.floor(Math.random() * chars.length)));
    return `${this.PREFIX}${randomChars.join("")}`;
  }
}

/**
 * Creates a mock CosmosWallet that mimics Keplr's signArbitrary implementation
 * @param wallet - The DirectSecp256k1HdWallet instance to use for signing
 * @returns A CosmosWallet interface implementation
 */
export async function createMockCosmosWallet(wallet: DirectSecp256k1HdWallet) {
  const [account] = await wallet.getAccounts();

  return {
    pubkey: account.pubkey,
    address: account.address,
    signArbitrary: async (signer: string, data: string | Uint8Array): Promise<StdSignature> => {
      const message = typeof data === "string" ? data : new TextDecoder().decode(data);

      // Sign the message using signDirect
      const signResponse = await wallet.signDirect(signer, {
        bodyBytes: new TextEncoder().encode(message),
        authInfoBytes: new Uint8Array(),
        chainId: "akashnet-2",
        accountNumber: BigInt(0)
      });

      // Convert the signature to the expected format
      return {
        signature: Buffer.from(signResponse.signature.signature).toString("base64"),
        pub_key: {
          type: "tendermint/PubKeySecp256k1",
          value: Buffer.from(account.pubkey).toString("base64")
        }
      };
    }
  };
}

/**
 * Replaces template values in JWT test cases with actual values
 * @param testCase - The test case containing template values
 * @returns The test case with template values replaced
 */
export function replaceTemplateValues(testCase: (typeof jwtClaimsTestCases)[0]) {
  const now = Math.floor(Date.now() / 1000);
  const issuer = AkashAddressSeeder.create();
  const provider = AkashAddressSeeder.create();

  const claims = { ...testCase.claims } as any;
  if (claims.iss === "{{.Issuer}}") claims.iss = issuer;
  if (claims.iat === "{{.Iat24h}}") claims.iat = now - 86400; // 24 hours ago
  if (claims.exp === "{{.Exp48h}}") claims.exp = now + 172800; // 48 hours from now
  if (!claims.nbf) claims.nbf = now;

  // Convert string timestamps to numbers
  if (typeof claims.iat === "string") claims.iat = parseInt(claims.iat, 10);
  if (typeof claims.exp === "string") claims.exp = parseInt(claims.exp, 10);
  if (typeof claims.nbf === "string") claims.nbf = parseInt(claims.nbf, 10);

  // Replace provider address in permissions if present
  if (claims.leases?.permissions) {
    claims.leases.permissions = claims.leases.permissions.map((perm: { provider: string; [key: string]: any }) => ({
      ...perm,
      provider: perm.provider === "{{.Provider}}" ? provider : perm.provider
    }));
  }

  return { ...testCase, claims: claims as JWTPayload };
}
