import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

import { jwtClaimsTestCases } from "../generated/jwtClaimsTestCases";
import { JwtToken } from "../JwtToken";
import { createMockCosmosWallet, replaceTemplateValues } from "./utils";

describe("JWT Claims Validation", () => {
  let testWallet: ReturnType<typeof createMockCosmosWallet> extends Promise<infer T> ? T : never;
  let jwtToken: JwtToken;

  beforeAll(async () => {
    const directWallet = await DirectSecp256k1HdWallet.fromMnemonic(
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      { prefix: "akash" }
    );
    testWallet = await createMockCosmosWallet(directWallet);
    jwtToken = new JwtToken(testWallet);
  });

  it.each(jwtClaimsTestCases)("$description", async testCase => {
    const { claims, expected } = replaceTemplateValues(testCase);

    if (expected.signFail || expected.verifyFail) {
      // For test cases that should fail, we need to validate the payload first
      const isValid = jwtToken.validatePayload(claims as any);
      expect(isValid).toBe(false);
      return;
    }

    const token = await jwtToken.createToken(claims as any);
    const decoded = jwtToken.decodeToken(token);
    expect(decoded).toBeDefined();
  });
});
