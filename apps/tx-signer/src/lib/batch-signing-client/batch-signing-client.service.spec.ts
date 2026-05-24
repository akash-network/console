import { TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
import type { AccountData, EncodeObject, GeneratedType } from "@cosmjs/proto-signing";
import { Registry } from "@cosmjs/proto-signing";
import type { Account, DeliverTxResponse, IndexedTx, SigningStargateClient } from "@cosmjs/stargate";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { createAkashAddress } from "../../../test/seeders";
import type { AppConfigService } from "../../services/app-config/app-config.service";
import type { Wallet } from "../wallet/wallet";
import { BatchSigningClientService } from "./batch-signing-client.service";

interface TransactionTestData {
  messages: readonly EncodeObject[];
  gasEstimate: number;
  signedMessage: TxRaw;
  hash: string | Error;
  tx: IndexedTx;
}

describe(BatchSigningClientService.name, () => {
  it("should batch and execute multiple transactions successfully", async () => {
    const testData = Array.from({ length: 5 }, () => createTransactionTestData());

    const { service, client } = setup(testData);

    const results = await Promise.all(testData.map(data => service.signAndBroadcast(data.messages)));

    expect(results).toHaveLength(testData.length);
    expect(results).toEqual(testData.map(data => data.tx));
    expect(client.broadcastTx).toHaveBeenCalledTimes(1);
    expect(client.broadcastTxSync).toHaveBeenCalledTimes(testData.length - 1);
  });

  it("should handle errors in batch without affecting other transactions", async () => {
    const successfulTestData = [createTransactionTestData(), createTransactionTestData(), createTransactionTestData(), createTransactionTestData()];
    const erroredTestData = createTransactionTestData();
    erroredTestData.hash = new Error("Test error");

    const allTestData = [...successfulTestData, erroredTestData];
    const { service, client } = setup(allTestData);

    const results = await Promise.allSettled(allTestData.map(data => service.signAndBroadcast(data.messages)));

    const fulfilledResults = results.filter(r => r.status === "fulfilled") as PromiseFulfilledResult<IndexedTx>[];
    const rejectedResults = results.filter(r => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilledResults).toHaveLength(successfulTestData.length);
    expect(rejectedResults).toHaveLength(1);
    expect(fulfilledResults.map(r => r.value)).toEqual(successfulTestData.map(data => data.tx));
    expect(rejectedResults[0].reason).toBeInstanceOf(Error);
    expect(client.broadcastTx).toHaveBeenCalledTimes(1);
    expect(client.broadcastTxSync).toHaveBeenCalledTimes(allTestData.length - 1);
  });

  it("should retry failed transaction within a batch on sequence mismatch error and eventually succeed", async () => {
    const successfulTestData = [createTransactionTestData(), createTransactionTestData(), createTransactionTestData(), createTransactionTestData()];
    const erroredTestData = createTransactionTestData();
    const { hash } = erroredTestData;
    erroredTestData.hash = new Error(
      "Query failed with (6): rpc error: code = Unknown desc = account sequence mismatch, expected 15533, got 15532: incorrect account sequence"
    );

    const allTestData = [...successfulTestData, erroredTestData];
    const { service, client, simulateMock } = setup(allTestData);

    simulateMock.mockResolvedValueOnce({ gasInfo: { gasUsed: BigInt(erroredTestData.gasEstimate) } });
    client.sign.mockResolvedValueOnce(erroredTestData.signedMessage);
    client.broadcastTx.mockResolvedValueOnce({ transactionHash: hash } as DeliverTxResponse);
    client.getTx.mockResolvedValueOnce(erroredTestData.tx);

    const results = await Promise.all(allTestData.map(data => service.signAndBroadcast(data.messages)));

    expect(results).toHaveLength(allTestData.length);
    expect(results).toEqual(allTestData.map(data => data.tx));
    expect(client.broadcastTx).toHaveBeenCalledTimes(2);
    expect(client.broadcastTxSync).toHaveBeenCalledTimes(allTestData.length - 1);
  });

  it("should propagate errors from getTx without retrying", async () => {
    const testData = createTransactionTestData();

    const { service, client } = setup([testData]);

    client.getTx.mockReset();
    const nonNetworkError = Object.assign(new Error("Invalid argument"), { code: "INVALID_ARGUMENT" });
    client.getTx.mockRejectedValue(nonNetworkError);

    await expect(service.signAndBroadcast(testData.messages)).rejects.toThrow("Invalid argument");
    expect(client.getTx).toHaveBeenCalledTimes(1);
  });

  it("throws when the recovered tx has a non-zero code, including rawLog so chain-error mapping works", async () => {
    const testData = createTransactionTestData();
    testData.tx = { ...testData.tx, code: 17, rawLog: "deployment exists" };

    const { service } = setup([testData]);

    await expect(service.signAndBroadcast(testData.messages)).rejects.toThrow(/deployment exists/i);
  });

  it("caches account info and sequence across sequential calls so getAccount is fetched only once", async () => {
    const calls = [createTransactionTestData(), createTransactionTestData(), createTransactionTestData()];
    const { service, client, simulateMock } = setup([]);

    for (const data of calls) {
      simulateMock.mockResolvedValueOnce({ gasInfo: { gasUsed: BigInt(data.gasEstimate) } });
      client.broadcastTx.mockResolvedValueOnce({ transactionHash: data.hash } as DeliverTxResponse);
      client.sign.mockResolvedValueOnce(data.signedMessage);
      client.getTx.mockResolvedValueOnce(data.tx);
      await service.signAndBroadcast(data.messages);
    }

    expect(client.getAccount).toHaveBeenCalledTimes(1);
    const signCalls = client.sign.mock.calls;
    expect(signCalls).toHaveLength(calls.length);
    expect(signCalls[0][4]?.sequence).toBe(1);
    expect(signCalls[1][4]?.sequence).toBe(2);
    expect(signCalls[2][4]?.sequence).toBe(3);
  });

  it("passes the local sequence explicitly to the tx.simulate query", async () => {
    const data = createTransactionTestData();
    const { service, simulateMock } = setup([data]);

    await service.signAndBroadcast(data.messages);

    expect(simulateMock).toHaveBeenCalledTimes(1);
    const [, memo, pubkey, sequence] = simulateMock.mock.calls[0];
    expect(memo).toBe("akash console");
    expect(pubkey).toBeDefined();
    expect(sequence).toBe(1);
  });

  it("recovers from sequence mismatch by parsing the expected sequence from the error and retrying without a fresh chain fetch", async () => {
    const data = createTransactionTestData();
    const { service, client, simulateMock } = setup([data]);

    const mismatchError = new Error(
      "Query failed with (6): rpc error: code = Unknown desc = account sequence mismatch, expected 42, got 1: incorrect account sequence"
    );

    client.broadcastTx.mockReset();
    client.broadcastTx.mockRejectedValueOnce(mismatchError).mockResolvedValueOnce({ transactionHash: data.hash } as DeliverTxResponse);

    simulateMock.mockResolvedValueOnce({ gasInfo: { gasUsed: BigInt(data.gasEstimate) } });
    client.sign.mockResolvedValueOnce(data.signedMessage);

    const result = await service.signAndBroadcast(data.messages);

    expect(result).toEqual(data.tx);
    expect(client.getAccount).toHaveBeenCalledTimes(1);
    const sequencesUsed = client.sign.mock.calls.map(call => call[4]?.sequence);
    expect(sequencesUsed[0]).toBe(1);
    expect(sequencesUsed[1]).toBe(42);
  });

  function createTransactionTestData(): TransactionTestData {
    const signedMessage = TxRaw.fromPartial({
      bodyBytes: generateRandomBytes(faker.number.int({ min: 10, max: 100 })),
      authInfoBytes: generateRandomBytes(faker.number.int({ min: 10, max: 100 })),
      signatures: [generateRandomBytes(faker.number.int({ min: 64, max: 128 }))]
    });
    const hash = toHex(sha256(TxRaw.encode(signedMessage).finish()));
    const gas = faker.number.int({ min: 1500, max: 3500 });

    return {
      messages: [
        {
          typeUrl: "/test.MsgTest",
          value: {}
        }
      ],
      gasEstimate: gas,
      signedMessage,
      hash,
      tx: {
        hash,
        txIndex: 0,
        code: 0,
        events: [],
        rawLog: "",
        height: faker.number.int({ min: 1, max: 1_000_000 }),
        tx: TxRaw.encode(signedMessage).finish(),
        msgResponses: [],
        gasUsed: BigInt(gas),
        gasWanted: BigInt(gas)
      }
    };
  }

  function generateRandomBytes(length: number): Uint8Array {
    return Uint8Array.from(Array.from({ length }, () => faker.number.int({ min: 0, max: 255 })));
  }

  function setup(testData: TransactionTestData[]) {
    const address = createAkashAddress();
    const compressedPubkey = new Uint8Array(33);
    compressedPubkey[0] = 0x02;
    for (let i = 1; i < 33; i++) compressedPubkey[i] = (i * 7) & 0xff;
    const accountData: AccountData = {
      address,
      algo: "secp256k1",
      pubkey: compressedPubkey
    };
    const wallet = mock<Wallet>({
      getFirstAddress: vi.fn(() => Promise.resolve(address)),
      getAccounts: vi.fn(() => Promise.resolve([accountData]))
    });

    const billingConfigService = mock<AppConfigService>({
      get: vi.fn().mockImplementation(key => {
        const values = {
          RPC_NODE_ENDPOINT: "http://localhost:26657",
          WALLET_BATCHING_INTERVAL_MS: 0,
          GAS_SAFETY_MULTIPLIER: 1.2,
          AVERAGE_GAS_PRICE: 0.025
        };
        return values[key as keyof typeof values];
      })
    });

    const stubType = {
      encode: () => ({ finish: () => new Uint8Array() }),
      decode: () => ({}),
      fromPartial: (v: unknown) => v
    } as unknown as GeneratedType;
    const registry = new Registry([["/test.MsgTest", stubType]]);
    const simulateMock = vi.fn();
    const queryClient = { tx: { simulate: simulateMock } };

    const client = mock<SigningStargateClient>({
      getChainId: vi.fn(async () => "test-chain"),
      getAccount: vi.fn(async (queriedAddress: string) => ({ accountNumber: 0, sequence: 1, address: queriedAddress }) as Account),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      forceGetQueryClient: vi.fn(() => queryClient as any)
    });

    testData.forEach((data, index) => {
      simulateMock.mockResolvedValueOnce({ gasInfo: { gasUsed: BigInt(data.gasEstimate) } });
      client.sign.mockResolvedValueOnce(data.signedMessage);

      if (index < testData.length - 1) {
        if (data.hash instanceof Error) {
          client.broadcastTxSync.mockRejectedValueOnce(data.hash);
        } else {
          client.broadcastTxSync.mockResolvedValueOnce(data.hash);
        }
      } else {
        if (data.hash instanceof Error) {
          client.broadcastTx.mockRejectedValueOnce(data.hash);
        } else {
          client.broadcastTx.mockResolvedValueOnce({ transactionHash: data.hash } as DeliverTxResponse);
        }
      }

      if (!(data.hash instanceof Error)) {
        client.getTx.mockResolvedValueOnce(data.tx);
      }
    });

    const createClientWithSigner = vi.fn(() => client);
    const service = new BatchSigningClientService(billingConfigService, wallet, registry, createClientWithSigner);

    return { service, client, simulateMock };
  }
});
