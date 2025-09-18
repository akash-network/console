import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
import { Registry } from "@cosmjs/proto-signing";
import type { Account } from "@cosmjs/stargate";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { mock } from "jest-mock-extended";

import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
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

  it("should cache first address and prevent race conditions", async () => {
    const { service, mockWallet } = setup();

    let resolveAddress: (value: string) => void;
    const addressPromise = new Promise<string>(resolve => {
      resolveAddress = resolve;
    });
    mockWallet.getFirstAddress.mockReturnValue(addressPromise);

    const promises = [service["getCachedFirstAddress"](), service["getCachedFirstAddress"](), service["getCachedFirstAddress"]()];

    setTimeout(() => resolveAddress!("akash1testaddress"), 10);

    const results = await Promise.all(promises);

    expect(results).toEqual(["akash1testaddress", "akash1testaddress", "akash1testaddress"]);
    expect(mockWallet.getFirstAddress).toHaveBeenCalledTimes(1);
  });

  it("should return cached first address on subsequent calls", async () => {
    const { service, mockWallet } = setup();
    mockWallet.getFirstAddress.mockResolvedValue("akash1testaddress");

    const firstResult = await service["getCachedFirstAddress"]();
    expect(firstResult).toBe("akash1testaddress");
    expect(mockWallet.getFirstAddress).toHaveBeenCalledTimes(1);

    const secondResult = await service["getCachedFirstAddress"]();
    expect(secondResult).toBe("akash1testaddress");
    expect(mockWallet.getFirstAddress).toHaveBeenCalledTimes(1);
  });

  it("should cache account info and prevent race conditions", async () => {
    const { service, mockClient } = setup();

    let resolveAccount: (value: Account) => void;
    const accountPromise = new Promise<Account>(resolve => {
      resolveAccount = resolve;
    });
    mockClient.getAccount.mockReturnValue(accountPromise);

    const promises = [service["getCachedAccountInfo"](), service["getCachedAccountInfo"](), service["getCachedAccountInfo"]()];

    setTimeout(
      () =>
        resolveAccount!({
          address: "akash1testaddress",
          pubkey: null,
          accountNumber: 1,
          sequence: 1
        }),
      10
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(results[0]).toMatchObject({
      accountNumber: 1,
      sequence: 1,
      address: "akash1testaddress"
    });
    expect(mockClient.getAccount).toHaveBeenCalledTimes(1);
  });

  it("should return cached account info on subsequent calls", async () => {
    const { service, mockClient } = setup();

    const firstResult = await service["getCachedAccountInfo"]();
    expect(firstResult).toMatchObject({
      accountNumber: 1,
      sequence: 1,
      address: "akash1testaddress"
    });
    expect(mockClient.getAccount).toHaveBeenCalledTimes(1);

    const secondResult = await service["getCachedAccountInfo"]();
    expect(secondResult).toEqual(firstResult);
    expect(mockClient.getAccount).toHaveBeenCalledTimes(1);
  });

  it("should clear cached account info when clearCachedAccountInfo is called", async () => {
    const { service, mockClient } = setup();

    await service["getCachedAccountInfo"]();
    expect(mockClient.getAccount).toHaveBeenCalledTimes(1);

    service["clearCachedAccountInfo"]();

    await service["getCachedAccountInfo"]();
    expect(mockClient.getAccount).toHaveBeenCalledTimes(2);
  });

  it("should increment sequence correctly", async () => {
    const { service } = setup();

    const initialInfo = await service["getCachedAccountInfo"]();
    expect(initialInfo.sequence).toBe(1);

    service["incrementSequence"]();
    const updatedInfo = await service["getCachedAccountInfo"]();
    expect(updatedInfo.sequence).toBe(2);

    service["incrementSequence"]();
    const finalInfo = await service["getCachedAccountInfo"]();
    expect(finalInfo.sequence).toBe(3);
  });

  it("should handle errors in first address fetching and clear promise", async () => {
    const { service, mockWallet } = setup();

    mockWallet.getFirstAddress.mockRejectedValue(new Error("Network error"));

    await expect(service["getCachedFirstAddress"]()).rejects.toThrow("Network error");

    await expect(service["getCachedFirstAddress"]()).rejects.toThrow("Network error");

    expect(mockWallet.getFirstAddress).toHaveBeenCalledTimes(2);
  });

  it("should handle errors in account info fetching and clear promise", async () => {
    const { service, mockClient } = setup();

    mockClient.getAccount.mockRejectedValue(new Error("Account not found"));

    await expect(service["getCachedAccountInfo"]()).rejects.toThrow("Account not found");

    await expect(service["getCachedAccountInfo"]()).rejects.toThrow("Account not found");

    expect(mockClient.getAccount).toHaveBeenCalledTimes(2);
  });

  it("should handle account not found error correctly", async () => {
    const { service, mockClient } = setup();

    mockClient.getAccount.mockResolvedValue(null);

    await expect(service["getCachedAccountInfo"]()).rejects.toThrow(
      "Account not found for address: akash1testaddress. The account may not exist on the blockchain yet."
    );
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

    const chainErrorService = mock<ChainErrorService>();

    const service = new BatchSigningClientService(mockConfig, mockWallet, mockRegistry, connectWithSigner, chainErrorService);

    return { service, expectedHash, mockWallet, mockConfig, mockRegistry, mockClient };
  }
});
