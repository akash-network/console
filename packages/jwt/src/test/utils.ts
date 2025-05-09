import { encodeSecp256k1Signature, type StdSignature } from "@cosmjs/amino";
import { Bip39, EnglishMnemonic, Secp256k1, sha256, Slip10, Slip10Curve, stringToPath } from "@cosmjs/crypto";
import type { DirectSecp256k1HdWallet, DirectSecp256k1HdWalletOptions } from "@cosmjs/proto-signing";

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
      const message = typeof data === "string" ? Buffer.from(data) : data;
      const hashedMessage = sha256(message);
      const seed = await fromMnemonic(wallet.mnemonic);
      const { privkey } = Slip10.derivePath(Slip10Curve.Secp256k1, seed, stringToPath("m/44'/118'/0'/0/0"));
      const signature = await Secp256k1.createSignature(hashedMessage, privkey);
      const signatureBytes = new Uint8Array([...signature.r(32), ...signature.s(32)]);
      const stdSignature = encodeSecp256k1Signature(account.pubkey, signatureBytes);

      return stdSignature;
    }
  };
}

async function fromMnemonic(mnemonic: string, options: Partial<DirectSecp256k1HdWalletOptions> = {}): Promise<Uint8Array> {
  const mnemonicChecked = new EnglishMnemonic(mnemonic);
  const seed = await Bip39.mnemonicToSeed(mnemonicChecked, options.bip39Password);
  return seed;
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
