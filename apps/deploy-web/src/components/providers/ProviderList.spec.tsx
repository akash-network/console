import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ClientProviderList } from "@src/types/provider";
import { DEPENDENCIES, ProviderList } from "./ProviderList";
import type { useProviderListModel } from "./useProviderListModel";
import { DEFAULT_PAGE_SIZE, SORT_OPTIONS } from "./useProviderListModel";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

type Model = ReturnType<typeof useProviderListModel>;

describe("ProviderList", () => {
  it("keeps the search and the filters within reach when the providers fail to load", () => {
    const { ProviderTable } = setup({ hasLoadedProviders: false, hasFailedToLoadProviders: true });

    expect(screen.getByText("Couldn't load providers.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search Providers" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Active" })).toBeInTheDocument();
    expect(ProviderTable).not.toHaveBeenCalled();
  });

  it("retries the provider search from the failure message", async () => {
    const { refresh } = setup({ hasLoadedProviders: false, hasFailedToLoadProviders: true });

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the search box while the first page loads", () => {
    const { ProviderTable } = setup({ hasLoadedProviders: false, isLoadingProviders: true });

    expect(screen.getByRole("textbox", { name: "Search Providers" })).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load providers.")).not.toBeInTheDocument();
    expect(ProviderTable).not.toHaveBeenCalled();
  });

  it("lists the providers of the loaded page", () => {
    const providers = [mock<ClientProviderList>({ owner: "akash1first" })];
    const { ProviderTable } = setup({ providers });

    expect(ProviderTable).toHaveBeenCalledWith(expect.objectContaining({ providers }), expect.anything());
    expect(screen.queryByText("No provider found.")).not.toBeInTheDocument();
  });

  it("tells no provider matched when the loaded page is empty", () => {
    setup({ providers: [] });

    expect(screen.getByText("No provider found.")).toBeInTheDocument();
  });

  function setup(modelOverrides: Partial<Model>) {
    const refresh = vi.fn();
    const model: Model = {
      sort: "active-leases-desc",
      sortOptions: SORT_OPTIONS,
      changeSort: vi.fn(),
      search: "",
      changeSearch: vi.fn(),
      isFilteringActive: true,
      changeIsFilteringActive: vi.fn(),
      isFilteringAudited: true,
      changeIsFilteringAudited: vi.fn(),
      isFilteringFavorites: false,
      changeIsFilteringFavorites: vi.fn(),
      pageIndex: 0,
      changePageIndex: vi.fn(),
      pageSize: DEFAULT_PAGE_SIZE,
      changePageSize: vi.fn(),
      pageCount: 0,
      providers: [],
      hasLoadedProviders: true,
      hasFailedToLoadProviders: false,
      isLoadingProviders: false,
      locations: undefined,
      networkCapacity: undefined,
      isLoading: false,
      refresh,
      ...modelOverrides
    };
    const dependencies = MockComponents(DEPENDENCIES, { useProviderListModel: () => model });

    render(<ProviderList dependencies={dependencies} />);

    return { refresh, ProviderTable: dependencies.ProviderTable };
  }
});
