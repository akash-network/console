import type { HttpClient, RestAkashLeaseListResponse, RpcLease } from "@akashnetwork/http-sdk";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { CHAIN_API_HTTP_CLIENT_TOKEN } from "@src/modules/alert/providers/http-sdk.provider";
import { ProviderActiveLeasesService } from "@src/modules/alert/services/provider-active-leases/provider-active-leases.service";

describe(ProviderActiveLeasesService.name, () => {
  it("paginates provider-filtered chain leases and keeps active and reclaiming workloads", async () => {
    const { service, chainApi } = await setup();
    chainApi.get
      .mockResolvedValueOnce({
        data: chainLeases(
          [
            lease({ owner: "akash1owner1", dseq: "100", gseq: 1, oseq: 1, bseq: 3 }, "active"),
            lease({ owner: "akash1owner2", dseq: "200", gseq: 2, oseq: 1, bseq: 4 }, "closed")
          ],
          "next-page"
        )
      })
      .mockResolvedValueOnce({
        data: chainLeases([
          lease({ owner: "akash1owner3", dseq: "300", gseq: 3, oseq: 1, bseq: 7 }, "reclaiming"),
          lease({ owner: "akash1owner4", dseq: "400", gseq: 4, oseq: 1, bseq: 8 }, "insufficient_funds")
        ])
      });

    const result = await service.list(PROVIDER, 2);

    expect(chainApi.get).toHaveBeenNthCalledWith(1, "/akash/market/v1beta5/leases/list", {
      params: {
        "filters.provider": PROVIDER,
        "pagination.limit": 2,
        "pagination.key": undefined
      },
      timeout: 30000
    });
    expect(chainApi.get).toHaveBeenNthCalledWith(2, "/akash/market/v1beta5/leases/list", {
      params: {
        "filters.provider": PROVIDER,
        "pagination.limit": 2,
        "pagination.key": "next-page"
      },
      timeout: 30000
    });
    expect(result).toEqual([
      { owner: "akash1owner1", dseq: "100", gseq: 1, oseq: 1, bseq: 3, provider: PROVIDER },
      { owner: "akash1owner3", dseq: "300", gseq: 3, oseq: 1, bseq: 7, provider: PROVIDER }
    ]);
  });

  it("stops after an empty page even when a malformed response includes a continuation key", async () => {
    const { service, chainApi } = await setup();
    chainApi.get.mockResolvedValue({ data: chainLeases([], "unexpected-next-page") });

    await expect(service.list(PROVIDER)).resolves.toEqual([]);
    expect(chainApi.get).toHaveBeenCalledTimes(1);
  });

  async function setup() {
    const module = await Test.createTestingModule({
      providers: [ProviderActiveLeasesService, { provide: CHAIN_API_HTTP_CLIENT_TOKEN, useValue: { get: vi.fn() } }]
    }).compile();

    return {
      service: module.get(ProviderActiveLeasesService),
      chainApi: module.get<MockProxy<HttpClient>>(CHAIN_API_HTTP_CLIENT_TOKEN)
    };
  }
});

const PROVIDER = "akash1provideraddressxxxxxxxxxxxxxxxxxxxxxx";

function chainLeases(leases: RpcLease[], nextKey: string | null = null): RestAkashLeaseListResponse {
  return {
    leases,
    pagination: { next_key: nextKey, total: String(leases.length) }
  };
}

function lease(
  input: { owner: string; dseq: string; gseq: number; oseq: number; bseq: number },
  state: "active" | "closed" | "insufficient_funds" | "reclaiming"
): RpcLease {
  return {
    lease: {
      id: { ...input, provider: PROVIDER },
      state,
      price: { denom: "uakt", amount: "1" },
      created_at: "1",
      closed_on: "0"
    },
    escrow_payment: {
      id: { aid: { scope: "deployment", xid: input.dseq }, xid: "1" },
      state: {
        owner: input.owner,
        state: "open",
        rate: { denom: "uakt", amount: "1" },
        balance: { denom: "uakt", amount: "1" },
        unsettled: { denom: "uakt", amount: "0" },
        withdrawn: { denom: "uakt", amount: "0" }
      }
    }
  };
}
