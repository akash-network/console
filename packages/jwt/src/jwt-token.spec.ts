import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

import { jwtClaimsTestCases } from "./generated/jwt-claims-test-cases";
import { jwtMnemonic } from "./generated/jwt-mnemonic";
import { jwtSigningTestCases } from "./generated/jwt-signing-test-cases";
import { replaceTemplateValues } from "./test/test-utils";
import { JwtToken } from "./jwt-token";
import type { JwtTokenOptions } from "./types";
import { createSignArbitraryAkashWallet, type SignArbitraryAkashWallet } from "./wallet-utils";

describe("JWT Claims Validation", () => {
  let testWallet: DirectSecp256k1HdWallet;
  let jwtToken: JwtToken;
  let akashWallet: SignArbitraryAkashWallet;

  beforeAll(async () => {
    testWallet = await DirectSecp256k1HdWallet.fromMnemonic(jwtMnemonic, {
      prefix: "akash"
    });
    akashWallet = await createSignArbitraryAkashWallet(testWallet);
    jwtToken = new JwtToken(akashWallet);
  });

  it.each(jwtClaimsTestCases)("$description", async testCase => {
    const { claims, tokenString } = replaceTemplateValues(testCase);

    // For test cases that should fail, we need to validate the payload first
    if (testCase.expected.signFail || testCase.expected.verifyFail) {
      const validationResult = jwtToken.validatePayload(claims);
      expect(validationResult.isValid).toBe(false);

      if (validationResult.isValid) {
        throw new Error("Validation should have failed", { cause: testCase });
      }

      return;
    }

    // For test cases that should pass, create and verify the token
    const token = await jwtToken.createToken(claims as JwtTokenOptions);
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
    const signResponse = await akashWallet.signArbitrary(akashWallet.address, signingString);

    const signature = Buffer.from(signResponse.signature, "base64url").toString("base64url");

    if (!testCase.mustFail) {
      expect(signature).toBe(expectedSignature);
    } else {
      expect(signature).not.toBe(expectedSignature);
    }
  });
});
