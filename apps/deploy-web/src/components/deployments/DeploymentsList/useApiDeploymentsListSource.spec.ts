import { createElement } from "react";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentsListPage } from "@src/queries/useDeploymentsListQuery";
import type { ListedDeploymentDto } from "@src/types/deployment";
import type { DEPENDENCIES } from "./useApiDeploymentsListSource";
import { SEARCH_PACING, useApiDeploymentsListSource } from "./useApiDeploymentsListSource";

import { act, renderHook } from "@testing-library/react";

describe(useApiDeploymentsListSource.name, () => {
  it("asks the api for the active page the reader is on", () => {
    const { useDeploymentsListQuery } = setup({ pageIndex: 2, pageSize: 10 });

    expect(useDeploymentsListQuery).toHaveBeenCalledWith({ state: "active", search: "", skip: 20, limit: 10 }, expect.anything());
  });

  it("asks the api for the archive page separately", () => {
    const { useDeploymentsListQuery } = setup({ archivePageIndex: 1, pageSize: 10 });

    expect(useDeploymentsListQuery).toHaveBeenCalledWith({ state: "closed", search: "", skip: 10, limit: 10 }, expect.anything());
  });

  it("hands each slice its rows, its count and whether another page follows", () => {
    const { result } = setup({
      active: page({ deployments: [listed("100")], total: 4, hasNextPage: true }),
      archive: page({ deployments: [listed("200")], total: 9, hasNextPage: false })
    });

    expect(result.current.active.deployments.map(deployment => deployment.dseq)).toEqual(["100"]);
    expect(result.current.active.hasNextPage).toBe(true);
    expect(result.current.archive.total).toBe(9);
    expect(result.current.archive.hasNextPage).toBe(false);
  });

  it("leaves both queries disabled until there is a wallet to list for", () => {
    const { useDeploymentsListQuery } = setup({ hasWallet: false });

    for (const call of useDeploymentsListQuery.mock.calls) {
      expect(call[1]).toMatchObject({ enabled: false });
    }
  });

  it("waits out a burst of typing before asking the api", async () => {
    vi.useFakeTimers();
    try {
      const { useDeploymentsListQuery, rerenderWith } = setup({ search: "" });
      useDeploymentsListQuery.mockClear();

      await act(async () => rerenderWith({ search: "w" }));
      await act(async () => rerenderWith({ search: "we" }));
      await act(async () => rerenderWith({ search: "web" }));

      expect(searchesAskedFor(useDeploymentsListQuery)).not.toContain("web");

      await act(async () => {
        vi.advanceTimersByTime(SEARCH_PACING.wait);
      });

      expect(searchesAskedFor(useDeploymentsListQuery)).toContain("web");
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes every page the api has answered with, whatever state or search it was for", () => {
    const { result, invalidateQueries, listKeyPrefix } = setup({});

    act(() => result.current.refetch());

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: listKeyPrefix });
  });

  it("reports a slice as resolved only once its query has answered", () => {
    const { result } = setup({ active: undefined });

    expect(result.current.active.isResolved).toBe(false);
  });

  it("passes on a slice whose search the api refused, so the list can say so instead of failing", () => {
    const { result } = setup({ search: "web", active: page({ isSearchTooBroad: true }), archive: page({}) });

    expect(result.current.active.isSearchTooBroad).toBe(true);
    expect(result.current.archive.isSearchTooBroad).toBe(false);
  });

  it("reports the search its rows were fetched with, not the one still being typed", async () => {
    vi.useFakeTimers();
    try {
      const { result, rerenderWith } = setup({ search: "" });

      await act(async () => rerenderWith({ search: "web" }));

      expect(result.current.appliedSearch).toBe("");

      await act(async () => {
        vi.advanceTimersByTime(SEARCH_PACING.wait);
      });

      expect(result.current.appliedSearch).toBe("web");
    } finally {
      vi.useRealTimers();
    }
  });

  function page(overrides: Partial<DeploymentsListPage>): DeploymentsListPage {
    return { deployments: [], total: 0, hasNextPage: false, isSearchTooBroad: false, ...overrides };
  }

  function searchesAskedFor(useDeploymentsListQuery: ReturnType<typeof vi.fn>) {
    return useDeploymentsListQuery.mock.calls.map(call => call[0].search);
  }

  function listed(dseq: string) {
    return mock<ListedDeploymentDto>({ dseq });
  }

  type Input = {
    search?: string;
    pageIndex?: number;
    pageSize?: number;
    archivePageIndex?: number;
    hasWallet?: boolean;
    active?: DeploymentsListPage;
    archive?: DeploymentsListPage;
    isFetching?: boolean;
    isError?: boolean;
  };

  function setup(input: Input) {
    let current = input;
    const invalidateQueries = vi.fn();
    const listKeyPrefix = ["v1", "listDeployments"];

    const useDeploymentsListQuery = vi.fn<typeof DEPENDENCIES.useDeploymentsListQuery>(params =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentsListQuery>>({
        data: params.state === "closed" ? current.archive : current.active,
        isFetching: current.isFetching ?? false,
        isError: current.isError ?? false
      })
    );

    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ hasWallet: current.hasWallet ?? true, address: "akash1owner" });
    const useQueryClient: typeof DEPENDENCIES.useQueryClient = () => mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>({ invalidateQueries });
    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        api: { v1: { listDeployments: { getKey: () => listKeyPrefix } } }
      } as never);

    const dependencies = { useWallet, useQueryClient, useServices, useDeploymentsListQuery };

    const store = createStore();
    const hook = renderHook(
      () =>
        useApiDeploymentsListSource(
          {
            search: current.search ?? "",
            pageIndex: current.pageIndex ?? 0,
            pageSize: current.pageSize ?? 10,
            archivePageIndex: current.archivePageIndex ?? 0
          },
          dependencies
        ),
      { wrapper: ({ children }) => createElement(Provider, { store }, children) }
    );

    return {
      ...hook,
      rerenderWith(next: Partial<Input>) {
        current = { ...current, ...next };
        hook.rerender();
      },
      useDeploymentsListQuery,
      invalidateQueries,
      listKeyPrefix
    };
  }
});
