import type { StdSignature } from "@cosmjs/amino";
import type { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

import type { jwtClaimsTestCases } from "../generated/jwtClaimsTestCases";

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
  const issuer = "akash1test1234567890";
  const provider = "akash1provider1234567890";

  const claims = { ...testCase.claims };
  if (claims.iss === "{{.Issuer}}") claims.iss = issuer;
  if (claims.iat === "{{.Iat24h}}") claims.iat = (now - 86400).toString(); // 24 hours ago
  if (claims.exp === "{{.Exp48h}}") claims.exp = (now + 172800).toString(); // 48 hours from now

  // Replace provider address in permissions if present
  if (claims.leases?.permissions) {
    claims.leases.permissions = claims.leases.permissions.map(perm => ({
      ...perm,
      provider: perm.provider === "{{.Provider}}" ? provider : perm.provider
    }));
  }

  return { ...testCase, claims };
}
