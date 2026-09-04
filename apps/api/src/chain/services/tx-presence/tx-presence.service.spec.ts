import type { GetTxResponse } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";
import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { TxPresenceService } from "./tx-presence.service";

const TX_HASH = "8E1F0A3D9C2B4E5F6071829304A5B6C7D8E9F0A1B2C3D4E5F60718293A4B5C6D";

describe(TxPresenceService.name, () => {
  it("reports the transaction the chain holds", async () => {
    const { service } = setup({
      answers: mockDeep<GetTxResponse>({ txResponse: { code: 0, height: 28343549n, rawLog: "" } })
    });

    await expect(service.findTx(TX_HASH)).resolves.toEqual({ hash: TX_HASH, code: 0, height: 28343549, rawLog: "" });
  });

  it("reports a reverted transaction with the code the chain gave it", async () => {
    const { service } = setup({
      answers: mockDeep<GetTxResponse>({ txResponse: { code: 11, height: 28343549n, rawLog: "out of gas" } })
    });

    await expect(service.findTx(TX_HASH)).resolves.toMatchObject({ code: 11, rawLog: "out of gas" });
  });

  it("reports a transaction the chain says it does not have as absent", async () => {
    const { service } = setup({ rejectsWith: new SDKError("[not_found] tx not found", SDKErrorCode.NotFound) });

    await expect(service.findTx(TX_HASH)).resolves.toBeNull();
  });

  it("reports an answer carrying no transaction as absent", async () => {
    const { service } = setup({ answers: mockDeep<GetTxResponse>({ txResponse: undefined }) });

    await expect(service.findTx(TX_HASH)).resolves.toBeNull();
  });

  it("rethrows an unreachable node rather than reporting absence", async () => {
    const { service } = setup({ rejectsWith: new SDKError("[unknown] fetch failed", SDKErrorCode.Unknown) });

    await expect(service.findTx(TX_HASH)).rejects.toThrow("fetch failed");
  });

  it("rethrows a timed out query rather than reporting absence", async () => {
    const { service } = setup({ rejectsWith: new SDKError("[deadline_exceeded] aborted due to timeout", SDKErrorCode.DeadlineExceeded) });

    await expect(service.findTx(TX_HASH)).rejects.toThrow("timeout");
  });

  it("asks the chain for the hash the caller named", async () => {
    const { service, chainSdk } = setup({ answers: mockDeep<GetTxResponse>({ txResponse: { code: 0, height: 1n, rawLog: "" } }) });

    await service.findTx(TX_HASH);

    expect(chainSdk.cosmos.tx.v1beta1.getTx).toHaveBeenCalledWith({ hash: TX_HASH });
  });

  function setup(input: { answers?: GetTxResponse; rejectsWith?: unknown }) {
    const chainSdk = mockDeep<ChainSDK>();

    chainSdk.cosmos.tx.v1beta1.getTx.mockImplementation(async () => {
      if (input.answers) return input.answers;
      throw input.rejectsWith;
    });

    const service = new TxPresenceService(chainSdk);

    return { service, chainSdk };
  }
});
