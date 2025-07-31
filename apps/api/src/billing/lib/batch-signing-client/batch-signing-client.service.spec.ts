import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
import { Registry } from "@cosmjs/proto-signing";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { mock } from "jest-mock-extended";

import type { BillingConfigService } from "../../services/billing-config/billing-config.service";
import type { SyncSigningStargateClient } from "../sync-signing-stargate-client/sync-signing-stargate-client";
import type { Wallet } from "../wallet/wallet";
import { BatchSigningClientService } from "./batch-signing-client.service";

describe("BatchSigningClientService", () => {
  it("should handle duplicate tx error gracefully and proceed with hash", async () => {
    const { service, expectedHash, mockClient } = setup();
    mockClient.tmBroadcastTxSync.mockImplementation(async () => {
      const error = new Error("tx already exists in cache");
      throw error;
    });
    mockClient.broadcastTx.mockImplementation(async () => {
      const error = new Error("tx already exists in cache");
      throw error;
    });
    const messages = [{ typeUrl: "/akash.test.MsgTest", value: {} }];

    const result = await service["executeTxBatch"]([{ messages }]);

    expect(result).toHaveLength(1);
    expect(result[0]?.hash).toBe(expectedHash);
  });

  function setup() {
    const dummyTxRaw = TxRaw.fromPartial({
      bodyBytes: new Uint8Array([1, 2, 3]),
      authInfoBytes: new Uint8Array([4, 5, 6]),
      signatures: [new Uint8Array([7, 8, 9])]
    });
    const dummyTxBytes = TxRaw.encode(dummyTxRaw).finish();
    const expectedHash = toHex(sha256(dummyTxBytes));

    const mockWallet = mock<Wallet>();
    mockWallet.getFirstAddress.mockResolvedValue("akash1testaddress");

    const mockConfig = mock<BillingConfigService>();
    (mockConfig.get as jest.Mock).mockImplementation(
      (key: string) =>
        ({
          MASTER_WALLET_MNEMONIC: "test mnemonic",
          RPC_NODE_ENDPOINT: "http://localhost:26657",
          WALLET_BATCHING_INTERVAL_MS: "0",
          GAS_SAFETY_MULTIPLIER: "1.2",
          AVERAGE_GAS_PRICE: 0.025
        })[key]
    );

    const mockRegistry = new Registry();

    const mockClient = mock<SyncSigningStargateClient>();
    mockClient.getChainId.mockResolvedValue("test-chain");
    mockClient.getAccount.mockResolvedValue({
      address: "akash1testaddress",
      pubkey: null,
      accountNumber: 1,
      sequence: 1
    });
    mockClient.sign.mockResolvedValue(dummyTxRaw);
    mockClient.simulate.mockResolvedValue(100000);
    mockClient.getTx.mockResolvedValue({
      height: 1,
      txIndex: 0,
      hash: expectedHash,
      code: 0,
      events: [],
      rawLog: "",
      tx: new Uint8Array(),
      msgResponses: [],
      gasUsed: BigInt(100000),
      gasWanted: BigInt(100000)
    });

    const connectWithSigner = jest.fn().mockResolvedValue(mockClient);

    const service = new BatchSigningClientService(mockConfig, mockWallet, mockRegistry, connectWithSigner);

    return { service, expectedHash, mockWallet, mockConfig, mockRegistry, mockClient };
  }
});
