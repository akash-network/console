import { TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { Registry } from "@cosmjs/proto-signing";
import type { Account, DeliverTxResponse } from "@cosmjs/stargate";
import type { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import { createAkashAddress } from "../../../../test/seeders";
import { RpcMessageService } from "../../services";
import type { BillingConfigService } from "../../services/billing-config/billing-config.service";
import type { ChainErrorService } from "../../services/chain-error/chain-error.service";
import type { SyncSigningStargateClient } from "../sync-signing-stargate-client/sync-signing-stargate-client";
import type { Wallet } from "../wallet/wallet";
import { BatchSigningClientService } from "./batch-signing-client.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

interface TransactionTestData {
  messages: readonly EncodeObject[];
  gasEstimate: number;
  signedMessage: TxRaw;
  hash: string | Error;
  tx: IndexedTx;
}

describe(BatchSigningClientService.name, () => {
  it("should batch and execute multiple transactions successfully", async () => {
    const granter = createAkashAddress();
    const testData = Array.from({ length: 5 }, () => createTransactionTestData(granter));

    const { service, client } = setup(testData);

    const results = await Promise.all(testData.map(data => service.signAndBroadcast(data.messages)));

    expect(results).toHaveLength(testData.length);
    expect(results).toEqual(testData.map(data => data.tx));
    expect(client.broadcastTx).toHaveBeenCalledTimes(1);
    expect(client.broadcastTxSync).toHaveBeenCalledTimes(testData.length - 1);
  });

  it("should handle errors in batch without affecting other transactions", async () => {
    const granter = createAkashAddress();
    const successfulTestData = [
      createTransactionTestData(granter),
      createTransactionTestData(granter),
      createTransactionTestData(granter),
      createTransactionTestData(granter)
    ];
    const erroredTestData = createTransactionTestData(granter);
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
    const granter = createAkashAddress();
    const successfulTestData = [
      createTransactionTestData(granter),
      createTransactionTestData(granter),
      createTransactionTestData(granter),
      createTransactionTestData(granter)
    ];
    const erroredTestData = createTransactionTestData(granter);
    const { hash } = erroredTestData;
    erroredTestData.hash = new Error(
      "Query failed with (6): rpc error: code = Unknown desc = account sequence mismatch, expected 15533, got 15532: incorrect account sequence [cosmos/cosmos-sdk@v0.53.3/x/auth/ante/sigverify.go:364] with gas used: '19186': unknown request"
    );

    const allTestData = [...successfulTestData, erroredTestData];
    const { service, client } = setup(allTestData);

    client.simulate.mockResolvedValueOnce(erroredTestData.gasEstimate);
    client.sign.mockResolvedValueOnce(erroredTestData.signedMessage);
    client.broadcastTx.mockResolvedValueOnce({ transactionHash: hash } as DeliverTxResponse);
    client.getTx.mockResolvedValueOnce(erroredTestData.tx);

    const results = await Promise.all(allTestData.map(data => service.signAndBroadcast(data.messages)));

    expect(results).toHaveLength(allTestData.length);
    expect(results).toEqual(allTestData.map(data => data.tx));
    expect(client.broadcastTx).toHaveBeenCalledTimes(2);
    expect(client.broadcastTxSync).toHaveBeenCalledTimes(allTestData.length - 1);
  });

  function createTransactionTestData(granter: string): TransactionTestData {
    const signedMessage = TxRaw.fromPartial({
      bodyBytes: generateRandomBytes(faker.number.int({ min: 10, max: 100 })),
      authInfoBytes: generateRandomBytes(faker.number.int({ min: 10, max: 100 })),
      signatures: [generateRandomBytes(faker.number.int({ min: 64, max: 128 }))]
    });
    const hash = toHex(sha256(TxRaw.encode(signedMessage).finish()));
    const gas = faker.number.int({ min: 1500, max: 3500 });

    return {
      messages: [
        new RpcMessageService().getFeesAllowanceGrantMsg({
          limit: faker.number.int({ min: 5_000_000, max: 10_000_000 }),
          grantee: createAkashAddress(),
          granter
        })
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
    const wallet = mock<Wallet>({
      getFirstAddress: jest.fn(() => Promise.resolve(createAkashAddress()))
    });

    const billingConfigService = mockConfigService<BillingConfigService>({
      MASTER_WALLET_MNEMONIC: "test mnemonic",
      RPC_NODE_ENDPOINT: "http://localhost:26657",
      WALLET_BATCHING_INTERVAL_MS: "0",
      GAS_SAFETY_MULTIPLIER: "1.2",
      AVERAGE_GAS_PRICE: 0.025
    });

    const registry = new Registry();

    const client = mock<SyncSigningStargateClient>({
      getChainId: jest.fn(async () => "test-chain"),
      getAccount: jest.fn(async (address: string) => ({ accountNumber: 0, sequence: 1, address }) as Account)
    });

    testData.forEach((data, index) => {
      client.simulate.mockResolvedValueOnce(data.gasEstimate);
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

    const createClientWithSigner = jest.fn(() => client);
    const chainErrorService = mock<ChainErrorService>({
      toAppError: jest.fn(async error => error)
    });

    const service = new BatchSigningClientService(billingConfigService, wallet, registry, createClientWithSigner, chainErrorService);

    return { service, client };
  }
});
