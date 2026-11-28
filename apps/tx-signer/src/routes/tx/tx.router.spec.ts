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

  it("passes on the seed version a derived tx names", async () => {
    const { controller } = setup();

    const response = await postDerivedTx(`/${MsgCreateCertificate.$type}`, { seedVersion: "v3" });

    expect(response.status).toBe(200);
    expect(controller.signWithDerivedWallet).toHaveBeenCalledWith({ data: expect.objectContaining({ derivationIndex: 1, seedVersion: "v3" }) });
  });

  it("rejects a derived tx that names something that is not a seed version", async () => {
    const { controller } = setup();

    const response = await postDerivedTx(`/${MsgCreateCertificate.$type}`, { seedVersion: "current" });

    expect(response.status).toBe(400);
    expect(controller.signWithDerivedWallet).not.toHaveBeenCalled();
  });

  it("rejects a funding tx that names something that is not a seed version for its grantee", async () => {
    const { controller } = setup();

    const response = await txRouter.request("/v1/tx/funding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          messages: [{ typeUrl: "/cosmos.feegrant.v1beta1.MsgGrantAllowance", value: Buffer.from([1, 2, 3]).toString("base64") }],
          granteeDerivationIndex: 1,
          granteeSeedVersion: "2"
        }
      })
    });

    expect(response.status).toBe(400);
    expect(controller.signWithFundingWallet).not.toHaveBeenCalled();
  });

  function postDerivedTx(typeUrl: string, extra: Record<string, unknown> = {}) {
    return txRouter.request("/v1/tx/derived", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data: {
          derivationIndex: 1,
          ...extra,
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
