import { MsgCreateCertificate } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { Registry } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import { mock } from "jest-mock-extended";
import { container } from "tsyringe";

import { TxController } from "@src/controllers/tx/tx.controller";
import { TYPE_REGISTRY } from "@src/providers/type-registry.provider";
import { app } from "@src/server";
import { TxManagerService } from "@src/services/tx-manager/tx-manager.service";

import { createAkashAddress } from "@test/seeders";

describe(TxController.name, () => {
  it("returns a successful derived wallet transaction", async () => {
    const registry = container.resolve<Registry>(TYPE_REGISTRY);
    const address = createAkashAddress();
    const message = {
      typeUrl: `/${MsgCreateCertificate.$type}`,
      value: MsgCreateCertificate.fromPartial({
        owner: address,
        cert: Uint8Array.from([1, 2, 3]),
        pubkey: Uint8Array.from([4, 5, 6])
      })
    };
    const payload = {
      data: {
        derivationIndex: 1,
        messages: [
          {
            typeUrl: message.typeUrl,
            value: Buffer.from(registry.encode(message)).toString("base64")
          }
        ]
      }
    };
    const txResult = mock<IndexedTx>({
      code: 0,
      hash: "tx-hash",
      rawLog: "success"
    });
    const txManagerService = mock<TxManagerService>({
      signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue(txResult)
    });
    container.registerInstance(TxManagerService, txManagerService);

    const res = await app.request("/v1/tx/derived", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: new Headers({ "Content-Type": "application/json" })
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      data: {
        code: 0,
        hash: "tx-hash",
        rawLog: "success"
      }
    });
  });
});
