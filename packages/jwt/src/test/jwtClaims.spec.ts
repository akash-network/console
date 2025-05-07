import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

import { jwtClaimsTestCases } from "../generated/jwtClaimsTestCases";
import { jwtMnemonic } from "../generated/jwtMnemonic";
import { jwtSigningTestCases } from "../generated/jwtSigningTestCases";
import { JwtToken } from "../JwtToken";
import type { CosmosWallet } from "../types";
import { createMockCosmosWallet, replaceTemplateValues } from "./utils";

describe("JWT Claims Validation", () => {
  let testWallet: DirectSecp256k1HdWallet;
  let jwtToken: JwtToken;

  beforeAll(async () => {
    testWallet = await DirectSecp256k1HdWallet.fromMnemonic(jwtMnemonic);
    const mockWallet = await createMockCosmosWallet(testWallet);
    jwtToken = new JwtToken(mockWallet);
  });

  it.each(jwtClaimsTestCases)("$description", async testCase => {
    const { claims, tokenString } = replaceTemplateValues(testCase);

    // For test cases that should fail, we need to validate the payload first
    if (testCase.expected.signFail || testCase.expected.verifyFail) {
      const isValid = await jwtToken.validatePayload(claims as any);
      expect(isValid).toBe(false);

      if (isValid) {
        throw new Error("Validation should have failed", { cause: testCase });
      }

      return;
    }

    // For test cases that should pass, create and verify the token
    const token = await jwtToken.createToken(claims as any);
    const decoded = jwtToken.decodeToken(token);
    expect(decoded).toBeDefined();

    // If the test case has a token string, compare it with the generated token
    if (tokenString) {
      expect(token).toEqual(tokenString);
    }
  });

  it.each(jwtSigningTestCases)("$description", async testCase => {
    // Create a mock wallet with the correct key for signing
    const mockWallet = {
      address: "bar",
      pubkey: new Uint8Array(0),
      signArbitrary: async (_signer: string, _data: string | Uint8Array): Promise<{ signature: string }> => {
        // Return the expected signature for the test case
        return {
          signature: "oN4T_XM-RlqC56wSoz9avJxZbWtern-2wUwIcytBo_gUQdqmudiOSUs4DfM6yzEcFth9OsZCXyXH0iQHvJzI6A"
        };
      }
    } as CosmosWallet;

    const jwtToken = new JwtToken(mockWallet);
    const token = await jwtToken.sign({ foo: "bar" } as any, "bar");

    if (!testCase.mustFail) {
      // For valid signatures, verify the token structure and signature
      const [header, payload, signature] = token.split(".");
      const [expectedHeader, expectedPayload, expectedSignature] = testCase.tokenString.split(".");

      // Verify header matches
      expect(header).toBe(expectedHeader);

      // Verify payload contains the required fields
      const decodedPayload = JSON.parse(Buffer.from(payload, "base64").toString());
      const expectedDecodedPayload = JSON.parse(Buffer.from(expectedPayload, "base64").toString());
      expect(decodedPayload.foo).toBe(expectedDecodedPayload.foo);

      // Verify signature
      expect(signature).toBe(expectedSignature);
    } else {
      // For invalid signatures, they should not match
      expect(token).not.toBe(testCase.tokenString);
    }
  });
});
