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
  let mockWallet: CosmosWallet;

  beforeAll(async () => {
    testWallet = await DirectSecp256k1HdWallet.fromMnemonic(jwtMnemonic, {
      prefix: "akash"
    });
    mockWallet = await createMockCosmosWallet(testWallet);
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
    const [expectedHeader, expectedPayload, expectedSignature] = testCase.tokenString.split(".");
    expect(expectedHeader).toBeDefined();
    expect(expectedPayload).toBeDefined();
    expect(expectedSignature).toBeDefined();

    const signingString = `${expectedHeader}.${expectedPayload}`;

    // Sign using the mock wallet's signArbitrary method
    const signResponse = await mockWallet.signArbitrary(mockWallet.address, signingString);

    const signature = Buffer.from(signResponse.signature, "base64url").toString("base64url");

    if (!testCase.mustFail) {
      expect(signature).toBe(expectedSignature);
    } else {
      expect(signature).not.toBe(expectedSignature);
    }
  });
});
