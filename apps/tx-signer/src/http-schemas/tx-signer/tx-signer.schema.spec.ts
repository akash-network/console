import { SignAndBroadcastFundingRequestInputSchema } from "./tx-signer.schema";

describe("tx-signer schema", () => {
  it("accepts valid funding request payload", () => {
    const result = SignAndBroadcastFundingRequestInputSchema.safeParse({
      data: {
        messages: [
          {
            typeUrl: "/test.MsgTest",
            value: Buffer.from([1, 2, 3]).toString("base64")
          }
        ]
      }
    });

    expect(result.success).toBe(true);
  });
});
