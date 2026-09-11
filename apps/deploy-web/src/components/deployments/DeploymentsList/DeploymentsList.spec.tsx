import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { NamedDeploymentDto } from "@src/types/deployment";
import type { DeploymentsCollectionProps } from "./DeploymentsCollection";
import { DEPENDENCIES, DeploymentsList } from "./DeploymentsList";
import type { useDeploymentsListModel } from "./useDeploymentsListModel";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

type Model = ReturnType<typeof useDeploymentsListModel>;

describe("DeploymentsList", () => {
  it("hides the whole header until a wallet exists", () => {
    setup({ hasWallet: false, hasAnyDeployment: true });

    expect(screen.queryByRole("heading", { name: "Deployments" })).not.toBeInTheDocument();
  });

  it("titles the page once a wallet exists", () => {
    setup({ hasWallet: true });

    expect(screen.getByRole("heading", { name: "Deployments" })).toBeInTheDocument();
  });

  it("hides search and the view toggle for an account with nothing to look through", () => {
    setup({ hasAnyDeployment: false, isSearching: false });

    expect(screen.queryByRole("textbox", { name: "Search deployments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Grid view" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /New deployment/ })).not.toBeInTheDocument();
  });

  it("keeps search on screen while a search is active but matched nothing", () => {
    setup({ hasAnyDeployment: false, isSearching: true, search: "acme" });

    expect(screen.getByRole("textbox", { name: "Search deployments" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /New deployment/ })).not.toBeInTheDocument();
  });

  it("reports what the reader typed", async () => {
    const { changeSearch } = setup({ hasAnyDeployment: true });

    await userEvent.type(screen.getByRole("textbox", { name: "Search deployments" }), "a");

    expect(changeSearch).toHaveBeenCalledWith("a");
  });

  it("offers a clear button only once something is typed", () => {
    setup({ hasAnyDeployment: true, search: "" });

    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("clears the search on demand", async () => {
    const { changeSearch } = setup({ hasAnyDeployment: true, search: "acme" });

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(changeSearch).toHaveBeenCalledWith("");
  });

  it("refreshes on demand", async () => {
    const { refetchDeployments } = setup({ hasAnyDeployment: true });

    await userEvent.click(screen.getByRole("button", { name: "Refresh deployments" }));

    expect(refetchDeployments).toHaveBeenCalled();
  });

  it("switches to the list view on demand", async () => {
    const { changeViewMode } = setup({ hasAnyDeployment: true, viewMode: "grid" });

    await userEvent.click(screen.getByRole("radio", { name: "List view" }));

    expect(changeViewMode).toHaveBeenCalledWith("list");
  });

  it("disables the New deployment link while the chain is down", () => {
    setup({ hasAnyDeployment: true }, { isBlockchainDown: true });

    expect(screen.getByRole("link", { name: /New deployment/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("leaves the New deployment link enabled while the chain is up", () => {
    setup({ hasAnyDeployment: true }, { isBlockchainDown: false });

    expect(screen.getByRole("link", { name: /New deployment/ })).toHaveAttribute("aria-disabled", "false");
  });

  it("drops any staged SDL when a new deployment is started", async () => {
    const { startNewDeployment } = setup({ hasAnyDeployment: true });

    await userEvent.click(screen.getByRole("link", { name: /New deployment/ }));

    expect(startNewDeployment).toHaveBeenCalled();
  });

  it("offers the bulk close only while something is selected", () => {
    setup({ selectedItemIds: [] });

    expect(screen.queryByRole("button", { name: /Close selected/ })).not.toBeInTheDocument();
  });

  it("counts the selection in the bulk close label", async () => {
    const { closeSelectedDeployments } = setup({ selectedItemIds: ["100", "101"] });

    await userEvent.click(screen.getByRole("button", { name: "Close selected (2)" }));

    expect(closeSelectedDeployments).toHaveBeenCalled();
  });

  it("clears the selection on demand", async () => {
    const { clearSelection } = setup({ selectedItemIds: ["100"] });

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(clearSelection).toHaveBeenCalled();
  });

  it("offers a retry when the deployments query failed", async () => {
    const { refetchDeployments } = setup({ showErrorState: true });

    expect(screen.getByText("Couldn't load deployments.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Retry/ }));

    expect(refetchDeployments).toHaveBeenCalled();
  });

  it("renders no error state when the query succeeded", () => {
    setup({ showErrorState: false });

    expect(screen.queryByText("Couldn't load deployments.")).not.toBeInTheDocument();
  });

  it("offers the onboarding empty state to an account with nothing deployed", () => {
    const { NoDeploymentsState } = setup({ hasSettledWithoutActiveDeployments: true, archiveDeployments: [] });

    expect(NoDeploymentsState).toHaveBeenCalledWith(expect.objectContaining({ hasDeployments: false, showTemplatesButton: true }), expect.anything());
  });

  it("tells an account whose deployments are all closed that none are active", () => {
    const { NoDeploymentsState } = setup({ hasSettledWithoutActiveDeployments: true, archiveDeployments: [namedDeployment("200")] });

    expect(NoDeploymentsState).toHaveBeenCalledWith(expect.objectContaining({ hasDeployments: true, showTemplatesButton: false }), expect.anything());
  });

  it("renders no empty state while the model is still resolving", () => {
    const { NoDeploymentsState } = setup({ hasSettledWithoutActiveDeployments: false });

    expect(NoDeploymentsState).not.toHaveBeenCalled();
  });

  it("spins while the first page is loading", () => {
    setup({ hasPageResults: false, isLoadingDeployments: true });

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("keeps the rows on screen instead of a spinner while a later page loads", () => {
    setup({ hasPageResults: true, isLoadingDeployments: true });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("hands the collection everything it needs to render and act on a page", () => {
    const deployments = [namedDeployment("100")];
    const { DeploymentsCollection, selectItem, refetchDeployments } = setup({
      hasPageResults: true,
      pageDeployments: deployments,
      viewMode: "list",
      selectedItemIds: ["100"]
    });

    expect(DeploymentsCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        deployments,
        viewMode: "list",
        isSelectable: true,
        selectedIds: ["100"],
        onSelect: selectItem,
        onDeploymentClosed: refetchDeployments
      }),
      expect.anything()
    );
  });

  it("renders no collection when the page is empty", () => {
    const { DeploymentsCollection } = setup({ hasPageResults: false });

    expect(DeploymentsCollection).not.toHaveBeenCalled();
  });

  it("says so when a search matched nothing anywhere", () => {
    setup({ showNoSearchResults: true });

    expect(screen.getByText("No deployment found.")).toBeInTheDocument();
  });

  it("stays quiet about no results when the search matched something", () => {
    setup({ showNoSearchResults: false });

    expect(screen.queryByText("No deployment found.")).not.toBeInTheDocument();
  });

  it("hides pagination when there is no page to move through", () => {
    setup({ hasPageResults: false });

    expect(screen.queryByRole("link", { name: "Go to next page" })).not.toBeInTheDocument();
  });

  it("disables Previous on the first page and Next on the last", () => {
    setup({ hasPageResults: true, pageIndex: 0, hasNextPage: false });

    expect(screen.getByRole("link", { name: "Go to previous page" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Go to next page" })).toHaveAttribute("aria-disabled", "true");
  });

  it("enables both directions in the middle of a run of pages", () => {
    setup({ hasPageResults: true, pageIndex: 1, hasNextPage: true });

    expect(screen.getByRole("link", { name: "Go to previous page" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Go to next page" })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("pages forward and back on demand", async () => {
    const { goToNextPage, goToPreviousPage } = setup({ hasPageResults: true, pageIndex: 1, hasNextPage: true });

    await userEvent.click(screen.getByRole("link", { name: "Go to next page" }));
    await userEvent.click(screen.getByRole("link", { name: "Go to previous page" }));

    expect(goToNextPage).toHaveBeenCalled();
    expect(goToPreviousPage).toHaveBeenCalled();
  });

  it("always offers the archive, whatever the active list is doing", () => {
    const archiveDeployments = [namedDeployment("200")];
    const { DeploymentArchive } = setup({ hasPageResults: false, archiveDeployments, viewMode: "grid" });

    expect(DeploymentArchive).toHaveBeenCalledWith(expect.objectContaining({ deployments: archiveDeployments, viewMode: "grid" }), expect.anything());
  });

  it("blocks the layout while either deployments or providers are loading", () => {
    const { Layout } = setup({ isLoadingDeployments: false, isLoadingProviders: true });

    expect(Layout).toHaveBeenCalledWith(expect.objectContaining({ isLoading: true }), expect.anything());
  });

  it("releases the layout once both have loaded", () => {
    const { Layout } = setup({ isLoadingDeployments: false, isLoadingProviders: false });

    expect(Layout).toHaveBeenCalledWith(expect.objectContaining({ isLoading: false }), expect.anything());
  });

  function namedDeployment(dseq: string) {
    return mock<NamedDeploymentDto>({ dseq, state: "closed" });
  }

  function setup(modelOverrides: Partial<Model>, options: { isBlockchainDown?: boolean } = {}) {
    const changeSearch = vi.fn();
    const changeViewMode = vi.fn();
    const refetchDeployments = vi.fn();
    const selectItem = vi.fn();
    const clearSelection = vi.fn();
    const closeSelectedDeployments = vi.fn();
    const startNewDeployment = vi.fn();
    const changePageSize = vi.fn();
    const goToPreviousPage = vi.fn();
    const goToNextPage = vi.fn();

    const model: Model = {
      hasWallet: true,
      providers: [],
      viewMode: "grid",
      changeViewMode,
      search: "",
      isSearching: false,
      changeSearch,
      pageDeployments: [],
      archiveDeployments: [],
      isLoadingDeployments: false,
      isLoadingProviders: false,
      isError: false,
      refetchDeployments,
      hasPageResults: false,
      hasAnyDeployment: true,
      hasSettledWithoutActiveDeployments: false,
      showErrorState: false,
      showNoSearchResults: false,
      pageIndex: 0,
      pageSize: 12,
      changePageSize,
      goToPreviousPage,
      goToNextPage,
      hasNextPage: false,
      selectedItemIds: [],
      selectItem,
      clearSelection,
      closeSelectedDeployments,
      startNewDeployment,
      ...modelOverrides
    };

    const useDeploymentsListModel: typeof DEPENDENCIES.useDeploymentsListModel = () => model;
    const useBlockchainStatus: typeof DEPENDENCIES.useBlockchainStatus = () =>
      mock<ReturnType<typeof DEPENDENCIES.useBlockchainStatus>>({ isBlockchainDown: options.isBlockchainDown ?? false });
    const useNewDeploymentUrl: typeof DEPENDENCIES.useNewDeploymentUrl = () => () => "/new-deployment";

    const Layout = vi.fn(({ children }: { children?: React.ReactNode; isLoading?: boolean }) => <div>{children}</div>);
    const NoDeploymentsState = vi.fn(() => <div>onboarding empty state</div>);
    const DeploymentsCollection = vi.fn((_props: DeploymentsCollectionProps) => <div>collection</div>);
    const DeploymentArchive = vi.fn(() => <div>archive</div>);

    render(
      <DeploymentsList
        dependencies={MockComponents(DEPENDENCIES, {
          useDeploymentsListModel,
          useBlockchainStatus,
          useNewDeploymentUrl,
          Layout,
          NoDeploymentsState,
          DeploymentsCollection,
          DeploymentArchive
        })}
      />
    );

    return {
      changeSearch,
      changeViewMode,
      refetchDeployments,
      selectItem,
      clearSelection,
      closeSelectedDeployments,
      startNewDeployment,
      changePageSize,
      goToPreviousPage,
      goToNextPage,
      Layout,
      NoDeploymentsState,
      DeploymentsCollection,
      DeploymentArchive
    };
  }
});
