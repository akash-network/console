import { mock } from "jest-mock-extended";
import { container } from "tsyringe";

import { TxController } from "../../controllers/tx/tx.controller";
import { txRouter } from "./tx.router";

describe("txRouter", () => {
  it("handles derived tx route", async () => {
    const controller = mock<TxController>({
      signWithDerivedWallet: jest.fn().mockResolvedValue({
        data: { code: 0, hash: "tx-hash", rawLog: "" }
      })
    });
    container.registerInstance(TxController, controller);

    const response = await txRouter.request("/v1/tx/derived", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data: {
          derivationIndex: 1,
          messages: [{ typeUrl: "/test.MsgTest", value: Buffer.from([1, 2, 3]).toString("base64") }]
        }
      })
    });

    expect(response.status).toBe(200);
    expect(controller.signWithDerivedWallet).toHaveBeenCalledTimes(1);
  });
});
