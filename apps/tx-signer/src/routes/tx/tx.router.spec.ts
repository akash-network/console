import { MsgCreateCertificate } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { TxController } from "../../controllers/tx/tx.controller";
import { txRouter } from "./tx.router";

describe("txRouter", () => {
  it("handles derived tx route", async () => {
    const { controller } = setup();

    const response = await postDerivedTx(`/${MsgCreateCertificate.$type}`);

    expect(response.status).toBe(200);
    expect(controller.signWithDerivedWallet).toHaveBeenCalledTimes(1);
  });

  it("rejects a derived tx message type the derived wallet is not allowed to sign", async () => {
    const { controller } = setup();

    const response = await postDerivedTx("/cosmos.bank.v1beta1.MsgSend");

    expect(response.status).toBe(400);
    expect(controller.signWithDerivedWallet).not.toHaveBeenCalled();
  });

  function postDerivedTx(typeUrl: string) {
    return txRouter.request("/v1/tx/derived", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data: {
          derivationIndex: 1,
          messages: [{ typeUrl, value: Buffer.from([1, 2, 3]).toString("base64") }]
        }
      })
    });
  }

  function setup() {
    const controller = mock<TxController>({
      signWithDerivedWallet: vi.fn().mockResolvedValue({
        data: { code: 0, hash: "tx-hash", rawLog: "" }
      })
    });
    container.registerInstance(TxController, controller);

    return { controller };
  }
});
