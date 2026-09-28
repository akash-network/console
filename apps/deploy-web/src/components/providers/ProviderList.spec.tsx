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

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load providers.");
    expect(screen.getByRole("textbox", { name: "Search Providers" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Active" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(ProviderTable).not.toHaveBeenCalled();
  });

  it("retries the provider search from the failure message", async () => {
    const { refresh } = setup({ hasLoadedProviders: false, hasFailedToLoadProviders: true });

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(refresh).toHaveBeenCalled();
  });

  it("refreshes the providers from the list header", async () => {
    const { refresh } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Refresh providers" }));

    expect(refresh).toHaveBeenCalled();
  });

  it("shows a spinner under the search box while the first page loads", () => {
    const { ProviderTable } = setup({ hasLoadedProviders: false, isLoadingProviders: true });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search Providers" })).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load providers.")).not.toBeInTheDocument();
    expect(ProviderTable).not.toHaveBeenCalled();
  });

  it("keeps the loaded page instead of a spinner while it is fetched again", () => {
    const { ProviderTable } = setup({ hasLoadedProviders: true, isLoadingProviders: true });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(ProviderTable).toHaveBeenCalled();
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

  it("clears the search from the search box", async () => {
    const { changeSearch } = setup({ search: "europlots" });

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(changeSearch).toHaveBeenCalledWith("");
  });

  it("offers no clear button for an empty search", () => {
    setup({ search: "" });

    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("names the selected sort in the sort picker", () => {
    setup({ sort: "gpu-available-desc" });

    expect(screen.getByText("GPUs Available (desc)")).toBeInTheDocument();
  });

  it("opens the page on becoming a provider in a new tab", async () => {
    const { windowOpen } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Become a provider" }));

    expect(windowOpen).toHaveBeenCalledWith("https://akash.network/providers/", "_blank");
  });

  function setup(modelOverrides: Partial<Model>) {
    const refresh = vi.fn();
    const changeSearch = vi.fn();
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    const model: Model = {
      sort: "active-leases-desc",
      sortOptions: SORT_OPTIONS,
      changeSort: vi.fn(),
      search: "",
      changeSearch,
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

    return { refresh, changeSearch, windowOpen, ProviderTable: dependencies.ProviderTable };
  }
});
