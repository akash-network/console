import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import type { ListDeploymentsItem } from "@src/types/deployment";
import { useDeploymentsListQuery } from "./useDeploymentsListQuery";

import { waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useDeploymentsListQuery.name, () => {
  it("asks the api for the state, order and page it was given", async () => {
    const { result, listDeployments } = setup({ state: "closed", skip: 10, limit: 10 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listDeployments).toHaveBeenCalledWith({ state: "closed", reverse: "true", skip: 10, limit: 10 });
  });

  it("leaves an empty search out of the request, so a cleared box shares a cache entry with no search at all", async () => {
    const { result, listDeployments } = setup({ search: "   " });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listDeployments).toHaveBeenCalledWith(expect.not.objectContaining({ search: expect.anything() }));
  });

  it("passes a search on once there is one", async () => {
    const { result, listDeployments } = setup({ search: "web" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listDeployments).toHaveBeenCalledWith(expect.objectContaining({ search: "web" }));
  });

  it("maps the answer into rows a list can render, with the count and whether another page exists", async () => {
    const { result } = setup({ items: [item("100"), item("200")], total: 7, hasMore: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.deployments.map(deployment => deployment.dseq)).toEqual(["100", "200"]);
    expect(result.current.data?.total).toBe(7);
    expect(result.current.data?.hasNextPage).toBe(true);
  });

  it("reads an account with no wallet yet as an empty page rather than a failure", async () => {
    const { result } = setup({ rejectWith: new ApiError(404, { message: "UserWallet Not Found" }, "not found") });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ deployments: [], total: 0, hasNextPage: false });
  });

  it("reads a wallet that is not initialized yet the same way", async () => {
    const { result } = setup({ rejectWith: new ApiError(403, { message: "UserWallet is not initialized" }, "forbidden") });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.deployments).toEqual([]);
  });

  it("reports a server fault rather than swallowing it as an empty account", async () => {
    const { result } = setup({ rejectWith: new ApiError(500, { message: "boom" }, "server error") });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("asks for nothing while it is disabled", async () => {
    const { result, listDeployments } = setup({ enabled: false });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    expect(listDeployments).not.toHaveBeenCalled();
  });

  function item(dseq: string) {
    return {
      deployment: { id: { owner: "akash1owner", dseq }, state: "active", hash: "hash", created_at: "1" },
      groups: [
        {
          id: { owner: "akash1owner", dseq, gseq: 1 },
          state: "open",
          group_spec: {
            name: "web",
            requirements: { signed_by: { all_of: [], any_of: [] }, attributes: [] },
            resources: [
              {
                resource: {
                  id: 1,
                  cpu: { units: { val: "1000" }, attributes: [] },
                  memory: { quantity: { val: "536870912" }, attributes: [] },
                  storage: [{ name: "default", quantity: { val: "536870912" }, attributes: [] }],
                  gpu: { units: { val: "0" }, attributes: [] },
                  endpoints: [{ kind: "SHARED_HTTP", sequence_number: 0 }]
                },
                count: 1,
                price: { denom: "uakt", amount: "100" }
              }
            ]
          },
          created_at: "1"
        }
      ],
      leases: [],
      escrow_account: {
        id: { scope: "deployment", xid: dseq },
        state: {
          owner: "akash1owner",
          state: "open",
          transferred: [{ denom: "uakt", amount: "0" }],
          settled_at: "1",
          funds: [{ denom: "uakt", amount: "5000000" }],
          deposits: []
        }
      },
      name: null,
      settings: null
    } as unknown as ListDeploymentsItem;
  }

  function setup(
    input: {
      state?: "active" | "closed";
      search?: string;
      skip?: number;
      limit?: number;
      enabled?: boolean;
      items?: ListDeploymentsItem[];
      total?: number;
      hasMore?: boolean;
      rejectWith?: unknown;
    } = {}
  ) {
    const listDeployments = vi.fn(async () =>
      input.rejectWith
        ? Promise.reject(input.rejectWith)
        : {
            data: {
              deployments: input.items ?? [],
              pagination: { total: input.total ?? 0, skip: input.skip ?? 0, limit: input.limit ?? 10, hasMore: input.hasMore ?? false }
            }
          }
    );

    const api = createProxy({ v1: { listDeployments } }) as unknown as ApiService;
    const hook = setupQuery(
      () =>
        useDeploymentsListQuery(
          { state: input.state ?? "active", search: input.search ?? "", skip: input.skip ?? 0, limit: input.limit ?? 10 },
          { enabled: input.enabled ?? true }
        ),
      { services: { api: () => api } }
    );

    return { ...hook, listDeployments };
  }
});
