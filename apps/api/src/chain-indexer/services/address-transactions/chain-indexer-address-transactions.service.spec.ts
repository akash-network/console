import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { ChainIndexerConfig } from "@src/chain-indexer/config/env.config";
import type { ChainIndexerApiClient } from "@src/chain-indexer/providers/chain-indexer-api.provider";
import { ChainIndexerAddressTransactionsService } from "@src/chain-indexer/services/address-transactions/chain-indexer-address-transactions.service";

type ListAddressTransactionsResponse = Awaited<ReturnType<ChainIndexerApiClient["v1"]["listAddressTransactions"]>>;

describe(ChainIndexerAddressTransactionsService.name, () => {
  it("serves the legacy shape from the api role's address history", async () => {
    const { service } = setup({
      data: {
        total: 3,
        transactions: [
          {
            height: 100,
            datetime: "2026-09-25T21:44:19.314Z",
            hash: "AB12",
            code: 0,
            gasUsed: 50,
            gasWanted: 70,
            fee: [{ denom: "uakt", amount: "1250" }],
            roles: ["signer", "sender"],
            messages: [
              { index: 0, type: "/cosmos.bank.v1beta1.MsgSend" },
              { index: 1, type: "/akash.deployment.v1beta4.MsgCloseDeployment" }
            ]
          }
        ]
      }
    });

    const result = await service.getTransactionsByAddress("akash1a", 0, 20);

    expect(result).toEqual({
      count: 3,
      results: [
        {
          height: 100,
          datetime: "2026-09-25T21:44:19.314Z",
          hash: "AB12",
          isSuccess: true,
          error: null,
          gasUsed: 50,
          gasWanted: 70,
          fee: 1250,
          memo: null,
          isSigner: true,
          messages: [
            { id: "AB12-0", type: "/cosmos.bank.v1beta1.MsgSend", amount: 0, isReceiver: false },
            { id: "AB12-1", type: "/akash.deployment.v1beta4.MsgCloseDeployment", amount: 0, isReceiver: false }
          ]
        }
      ]
    });
  });

  it("marks a failed transaction and a receiving address the way the legacy indexer did", async () => {
    const { service } = setup({
      data: {
        total: 1,
        transactions: [
          { height: 5, datetime: "d", hash: "CD", code: 11, gasUsed: 1, gasWanted: 2, fee: [], roles: ["receiver"], messages: [{ index: 0, type: "/m" }] }
        ]
      }
    });

    const result = await service.getTransactionsByAddress("akash1a", 0, 20);

    expect(result.results[0]).toMatchObject({ isSuccess: false, fee: 0, isSigner: false, messages: [{ isReceiver: true }] });
  });

  it("sums only the uakt part of a fee, as the legacy column held uakt", async () => {
    const { service } = setup({
      data: {
        total: 1,
        transactions: [
          {
            height: 5,
            datetime: "d",
            hash: "CD",
            code: 0,
            gasUsed: 1,
            gasWanted: 2,
            fee: [
              { denom: "uakt", amount: "300" },
              { denom: "uusdc", amount: "999" },
              { denom: "uakt", amount: "200" }
            ],
            roles: ["signer"],
            messages: []
          }
        ]
      }
    });

    const result = await service.getTransactionsByAddress("akash1a", 0, 20);

    expect(result.results[0].fee).toBe(500);
  });

  it("passes the page through to the api role with a request deadline", async () => {
    const { service, api } = setup({ data: { total: 0, transactions: [] } });

    await service.getTransactionsByAddress("akash1a", 40, 20);

    expect(api.v1.listAddressTransactions).toHaveBeenCalledWith({ address: "akash1a", skip: 40, limit: 20 }, { signal: expect.any(AbortSignal) });
  });

  it("aborts the request once the configured timeout elapses", async () => {
    const { service, api } = setup({ data: { total: 0, transactions: [] } }, { timeoutMs: 1 });

    await service.getTransactionsByAddress("akash1a", 0, 20);
    await new Promise(resolve => setTimeout(resolve, 20));

    const [, options] = api.v1.listAddressTransactions.mock.calls[0];
    expect(options?.signal?.aborted).toBe(true);
  });

  function setup(response: ListAddressTransactionsResponse, input: { timeoutMs?: number } = {}) {
    const api = mockDeep<ChainIndexerApiClient>();
    api.v1.listAddressTransactions.mockResolvedValue(response);
    const config: ChainIndexerConfig = {
      CHAIN_INDEXER_API_BASE_URL: "https://chain-indexer.test",
      CHAIN_INDEXER_REQUEST_TIMEOUT_MS: input.timeoutMs ?? 10_000
    };
    const service = new ChainIndexerAddressTransactionsService(api, config);
    return { service, api };
  }
});
