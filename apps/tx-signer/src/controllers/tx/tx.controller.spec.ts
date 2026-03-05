import type { Registry } from "@cosmjs/proto-signing";
import { mock } from "jest-mock-extended";

import type { TxManagerService } from "@src/services/tx-manager/tx-manager.service";
import { TxController } from "./tx.controller";

describe(TxController.name, () => {
  it("decodes messages and signs with funding wallet", async () => {
    const decodedMessage = { typeUrl: "/test.MsgTest", value: { foo: "bar" } };
    const registry = mock<Registry>({
      decode: jest.fn().mockReturnValue(decodedMessage.value)
    });
    const txManagerService = mock<TxManagerService>({
      signAndBroadcastWithFundingWallet: jest.fn().mockResolvedValue({ code: 0, hash: "tx", rawLog: "" })
    });

    const controller = new TxController(registry, txManagerService);
    const result = await controller.signWithFundingWallet({
      data: {
        messages: [
          {
            typeUrl: decodedMessage.typeUrl,
            value: Buffer.from([1, 2, 3]).toString("base64")
          }
        ]
      }
    });

    expect(registry.decode).toHaveBeenCalledWith({ typeUrl: decodedMessage.typeUrl, value: expect.any(Uint8Array) });
    expect(txManagerService.signAndBroadcastWithFundingWallet).toHaveBeenCalledWith([decodedMessage]);
    expect(result.data.code).toBe(0);
  });
});
