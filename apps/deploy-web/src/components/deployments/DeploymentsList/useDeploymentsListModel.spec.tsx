import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import sdlStore from "@src/store/sdlStore";
import type { TemplateCreation } from "@src/types";
import type { ListedDeploymentDto } from "@src/types/deployment";
import type { DeploymentsListSource, DeploymentsListSourceInput } from "./useApiDeploymentsListSource";
import { DEFAULT_PAGE_SIZE, DEPENDENCIES, useDeploymentsListModel } from "./useDeploymentsListModel";

import { act, renderHook, waitFor } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(useDeploymentsListModel.name, () => {
  it("asks the source for the first active page at the default size while nobody is searching", () => {
    const { useDeploymentsListSource } = setup({ active: [deployment("100")] });

    expect(useDeploymentsListSource).toHaveBeenCalledWith({ search: "", pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE, archivePageIndex: 0 });
  });

  it("shows the rows the source answered with", () => {
    const { result } = setup({ active: [deployment("100")] });

    expect(result.current.pageDeployments.map(d => d.dseq)).toEqual(["100"]);
  });

  describe("searching", () => {
    it("hands the source the search as typed, back on the first page", async () => {
      const { result, useDeploymentsListSource } = setup({ active: [deployment("100")], hasNextPage: true });

      await act(async () => result.current.goToNextPage());
      await act(async () => result.current.changeSearch("acme"));

      expect(useDeploymentsListSource).toHaveBeenLastCalledWith({ search: "acme", pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE, archivePageIndex: 0 });
    });

    it("treats whitespace as no search at all", async () => {
      const { result } = setup({ active: [deployment("100")] });

      await act(async () => result.current.changeSearch("   "));

      expect(result.current.isSearching).toBe(false);
    });

    it("reports no results only when neither the active list nor the archive matched", async () => {
      const { result, rerenderWith } = setup({ active: [deployment("100")], archived: [deployment("200", "closed")] });

      await act(async () => result.current.changeSearch("nothing-matches-this"));
      rerenderWith({ active: [], archived: [] });

      expect(result.current.showNoSearchResults).toBe(true);
    });

    it("keeps quiet about no results while the archive still has a match", async () => {
      const { result, rerenderWith } = setup({ active: [deployment("100")], archived: [deployment("299", "closed")] });

      await act(async () => result.current.changeSearch("299"));
      rerenderWith({ active: [] });

      expect(result.current.showNoSearchResults).toBe(false);
    });

    it("returns to the first page when the search changes", async () => {
      const { result } = setup({ active: [deployment("100")], hasNextPage: true });

      await act(async () => result.current.changeSearch("1"));
      await act(async () => result.current.goToNextPage());
      expect(result.current.pageIndex).toBe(1);

      await act(async () => result.current.changeSearch("10"));

      expect(result.current.pageIndex).toBe(0);
    });
  });

  describe("paging", () => {
    it("reports the next page the source reports", () => {
      const { result } = setup({ active: [deployment("100")], hasNextPage: true });

      expect(result.current.hasNextPage).toBe(true);
    });

    it("reports no next page when the source reports none", () => {
      const { result } = setup({ active: [deployment("100")], hasNextPage: false });

      expect(result.current.hasNextPage).toBe(false);
    });

    it("asks the source for the next page once the reader pages forward", async () => {
      const { result, useDeploymentsListSource } = setup({ active: [deployment("100")], hasNextPage: true });

      await act(async () => result.current.goToNextPage());

      expect(result.current.pageIndex).toBe(1);
      expect(useDeploymentsListSource).toHaveBeenLastCalledWith(expect.objectContaining({ pageIndex: 1, pageSize: DEFAULT_PAGE_SIZE }));
    });

    it("never pages back past the first page", async () => {
      const { result } = setup({ active: [deployment("100")] });

      await act(async () => result.current.goToPreviousPage());

      expect(result.current.pageIndex).toBe(0);
    });

    it("steps back one page at a time", async () => {
      const { result } = setup({ active: [deployment("100")], hasNextPage: true });

      await act(async () => result.current.goToNextPage());
      await act(async () => result.current.goToNextPage());
      await act(async () => result.current.goToPreviousPage());

      expect(result.current.pageIndex).toBe(1);
    });

    it("returns to the first page when the page size changes", async () => {
      const { result, useDeploymentsListSource } = setup({ active: [deployment("100")], hasNextPage: true });

      await act(async () => result.current.goToNextPage());
      await act(async () => result.current.changePageSize(50));

      expect(result.current.pageIndex).toBe(0);
      expect(result.current.pageSize).toBe(50);
      expect(useDeploymentsListSource).toHaveBeenLastCalledWith({ search: "", pageIndex: 0, pageSize: 50, archivePageIndex: 0 });
    });

    it("steps back one page at a time until it lands on one that still has rows", async () => {
      const { result } = setup({
        activeByPage: { 0: [deployment("100")], 1: [deployment("101")], 2: [] },
        hasNextPage: true
      });

      await act(async () => result.current.goToNextPage());
      await act(async () => result.current.goToNextPage());

      await waitFor(() => expect(result.current.pageIndex).toBe(1));
      expect(result.current.pageDeployments.map(d => d.dseq)).toEqual(["101"]);
    });

    it("falls back a page when the current one has emptied out", async () => {
      const { result, rerenderWith } = setup({ active: [deployment("100")], hasNextPage: true });

      await act(async () => result.current.goToNextPage());
      expect(result.current.pageIndex).toBe(1);

      rerenderWith({ active: [] });

      await waitFor(() => expect(result.current.pageIndex).toBe(0));
    });

    it("stays put on an empty page while the query is still loading", async () => {
      const { result, rerenderWith } = setup({ active: [deployment("100")], hasNextPage: true });

      await act(async () => result.current.goToNextPage());
      rerenderWith({ active: [], isFetching: true });

      expect(result.current.pageIndex).toBe(1);
    });

    it("stays put on an empty page when the query failed, so the retry has something to retry", async () => {
      const { result, rerenderWith } = setup({ active: [deployment("100")], hasNextPage: true });

      await act(async () => result.current.goToNextPage());
      rerenderWith({ active: [], isError: true });

      expect(result.current.pageIndex).toBe(1);
    });
  });

  describe("archive paging", () => {
    it("pages the archive at the size the active list is using", () => {
      const { result } = setup({ archived: closedDeployments(DEFAULT_PAGE_SIZE + 3) });

      expect(result.current.archivePageDeployments).toHaveLength(DEFAULT_PAGE_SIZE);
      expect(result.current.archiveTotal).toBe(DEFAULT_PAGE_SIZE + 3);
      expect(result.current.hasNextArchivePage).toBe(true);
    });

    it("leaves an archive that fits on one page unpaged", () => {
      const { result } = setup({ archived: closedDeployments(DEFAULT_PAGE_SIZE) });

      expect(result.current.hasNextArchivePage).toBe(false);
      expect(result.current.isArchivePaginated).toBe(false);
    });

    it("keeps the pager on the last page, where there is nowhere further to go", async () => {
      const { result } = setup({ archived: closedDeployments(DEFAULT_PAGE_SIZE + 2) });

      await act(async () => result.current.goToNextArchivePage());

      expect(result.current.hasNextArchivePage).toBe(false);
      expect(result.current.isArchivePaginated).toBe(true);
    });

    it("asks the source for the next archive page once the reader pages forward", async () => {
      const { result, useDeploymentsListSource } = setup({ archived: closedDeployments(DEFAULT_PAGE_SIZE + 2) });

      await act(async () => result.current.goToNextArchivePage());

      expect(result.current.archivePageIndex).toBe(1);
      expect(useDeploymentsListSource).toHaveBeenLastCalledWith(expect.objectContaining({ archivePageIndex: 1 }));
      expect(result.current.archivePageDeployments).toHaveLength(2);
      expect(result.current.hasNextArchivePage).toBe(false);
    });

    it("never pages back past the first page", async () => {
      const { result } = setup({ archived: closedDeployments(3) });

      await act(async () => result.current.goToPreviousArchivePage());

      expect(result.current.archivePageIndex).toBe(0);
    });

    it("steps back one page at a time", async () => {
      const { result } = setup({ archived: closedDeployments(DEFAULT_PAGE_SIZE * 3) });

      await act(async () => result.current.goToNextArchivePage());
      await act(async () => result.current.goToNextArchivePage());
      await act(async () => result.current.goToPreviousArchivePage());

      expect(result.current.archivePageIndex).toBe(1);
    });

    it("repages the archive from the top when the page size changes, even where the current page would still have rows", async () => {
      const { result } = setup({ archived: closedDeployments(60) });

      await act(async () => result.current.goToNextArchivePage());
      await act(async () => result.current.changePageSize(50));

      expect(result.current.archivePageIndex).toBe(0);
      expect(result.current.archivePageDeployments).toHaveLength(50);
    });

    it("returns the archive to its first page when the search changes, even where the page still matches", async () => {
      const { result } = setup({ active: [deployment("100")], archived: closedDeployments(DEFAULT_PAGE_SIZE + 1) });

      await act(async () => result.current.goToNextArchivePage());
      await act(async () => result.current.changeSearch("2"));

      expect(result.current.archiveTotal).toBe(DEFAULT_PAGE_SIZE + 1);
      expect(result.current.archivePageIndex).toBe(0);
    });

    it("falls back to the last page that still has rows rather than all the way to the first", async () => {
      const { result, rerenderWith } = setup({ archived: closedDeployments(DEFAULT_PAGE_SIZE * 3) });

      await act(async () => result.current.goToNextArchivePage());
      await act(async () => result.current.goToNextArchivePage());
      expect(result.current.archivePageIndex).toBe(2);

      rerenderWith({ archived: closedDeployments(DEFAULT_PAGE_SIZE + 5) });

      await waitFor(() => expect(result.current.archivePageIndex).toBe(1));
      expect(result.current.archivePageDeployments).toHaveLength(5);
    });

    it("stays put on an empty archive page while the query is still loading", async () => {
      const { result, rerenderWith } = setup({ archived: closedDeployments(DEFAULT_PAGE_SIZE + 1) });

      await act(async () => result.current.goToNextArchivePage());
      rerenderWith({ archived: [], isArchiveFetching: true });

      expect(result.current.archivePageIndex).toBe(1);
    });
  });

  describe("refreshing", () => {
    it("asks the source to fetch the list again", () => {
      const { result, refetch } = setup({ active: [deployment("100")] });

      act(() => result.current.refetchDeployments());

      expect(refetch).toHaveBeenCalled();
    });
  });

  describe("closing the selected deployments", () => {
    it("signs one message per selected deployment and then clears the selection", async () => {
      const { result, signAndBroadcastTx, closeDeploymentConfirm, refetch } = setup({ active: [deployment("100"), deployment("101")] });

      act(() => result.current.selectItem({ id: "100", isShiftPressed: false }));
      act(() => result.current.selectItem({ id: "101", isShiftPressed: false }));
      await act(async () => await result.current.closeSelectedDeployments());

      expect(closeDeploymentConfirm).toHaveBeenCalledWith(["100", "101"]);
      expect(signAndBroadcastTx).toHaveBeenCalledWith([expect.anything(), expect.anything()]);
      expect(refetch).toHaveBeenCalled();
      expect(result.current.selectedItemIds).toEqual([]);
    });

    it("records how many deployments the landed close covered", async () => {
      const { result, analyticsService } = setup({ active: [deployment("100"), deployment("101")] });

      act(() => result.current.selectItem({ id: "100", isShiftPressed: false }));
      act(() => result.current.selectItem({ id: "101", isShiftPressed: false }));
      await act(async () => await result.current.closeSelectedDeployments());

      expect(analyticsService.track).toHaveBeenCalledWith("close_deployment", {
        category: "deployments",
        label: "Close selected deployments from list",
        count: 2
      });
    });

    it("does nothing when the confirmation is declined", async () => {
      const { result, signAndBroadcastTx, analyticsService } = setup({ active: [deployment("100")], isCloseConfirmed: false });

      act(() => result.current.selectItem({ id: "100", isShiftPressed: false }));
      await act(async () => await result.current.closeSelectedDeployments());

      expect(signAndBroadcastTx).not.toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalled();
      expect(result.current.selectedItemIds).toEqual(["100"]);
    });

    it("records no close when the transaction does not land", async () => {
      const { result, analyticsService } = setup({ active: [deployment("100")], broadcastResponse: false });

      act(() => result.current.selectItem({ id: "100", isShiftPressed: false }));
      await act(async () => await result.current.closeSelectedDeployments());

      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("keeps the selection when the transaction does not land", async () => {
      const { result, refetch } = setup({ active: [deployment("100")], broadcastResponse: false });

      act(() => result.current.selectItem({ id: "100", isShiftPressed: false }));
      await act(async () => await result.current.closeSelectedDeployments());

      expect(refetch).not.toHaveBeenCalled();
      expect(result.current.selectedItemIds).toEqual(["100"]);
    });

    it("clears the selection on demand", () => {
      const { result } = setup({ active: [deployment("100")] });

      act(() => result.current.selectItem({ id: "100", isShiftPressed: false }));
      act(() => result.current.clearSelection());

      expect(result.current.selectedItemIds).toEqual([]);
    });
  });

  describe("view mode", () => {
    it("starts in the grid view", () => {
      const { result } = setup({ active: [deployment("100")] });

      expect(result.current.viewMode).toBe("grid");
    });

    it("switches to the list view and persists the choice", async () => {
      const { result } = setup({ active: [deployment("100")] });

      await act(async () => result.current.changeViewMode("list"));

      expect(result.current.viewMode).toBe("list");
      expect(localStorage.getItem("deploymentsViewMode")).toBe(JSON.stringify("list"));
    });

    it("ignores a value that is not one of the two views", async () => {
      const { result } = setup({ active: [deployment("100")] });

      await act(async () => result.current.changeViewMode(""));

      expect(result.current.viewMode).toBe("grid");
    });
  });

  describe("page-level states", () => {
    it("offers the onboarding empty state to an account with nothing at all", () => {
      const { result } = setup({ active: [], archived: [] });

      expect(result.current.hasSettledWithoutActiveDeployments).toBe(true);
      expect(result.current.hasAnyDeployment).toBe(false);
    });

    it("counts an account that has paged forward as having deployments, even on an empty page", async () => {
      const { result, rerenderWith } = setup({ active: [deployment("100")], hasNextPage: true });

      await act(async () => result.current.goToNextPage());
      rerenderWith({ active: [], isFetching: true });

      expect(result.current.hasAnyDeployment).toBe(true);
    });

    it("counts an account with only closed deployments as having deployments when the count is unknown", () => {
      const { result } = setup({ active: [], archived: [deployment("200", "closed")], unknownArchiveTotal: true });

      expect(result.current.archiveTotal).toBeNull();
      expect(result.current.hasAnyArchived).toBe(true);
      expect(result.current.hasAnyDeployment).toBe(true);
    });

    it("counts an account with only closed deployments as having deployments", () => {
      const { result } = setup({ active: [], archived: [deployment("200", "closed")] });

      expect(result.current.hasAnyDeployment).toBe(true);
      expect(result.current.hasSettledWithoutActiveDeployments).toBe(true);
    });

    it("reports an initial load until the first page resolves", () => {
      const { result } = setup({ isUnresolved: true, isFetching: true });

      expect(result.current.isInitialLoad).toBe(true);
    });

    it("holds placeholders through the archive fetch that the empty state waits on", () => {
      const { result } = setup({ active: [], isArchiveUnresolved: true, isArchiveFetching: true });

      expect(result.current.hasPageResults).toBe(false);
      expect(result.current.hasSettledWithoutActiveDeployments).toBe(false);
      expect(result.current.isInitialLoad).toBe(true);
    });

    it("shows the rows as soon as they resolve rather than waiting on the archive", () => {
      const { result } = setup({ active: [deployment("100")], isArchiveUnresolved: true, isArchiveFetching: true });

      expect(result.current.hasPageResults).toBe(true);
      expect(result.current.isInitialLoad).toBe(false);
    });

    it("gives up on placeholders when the archive fails rather than holding them forever", () => {
      const { result } = setup({ active: [], isArchiveUnresolved: true, isArchiveError: true });

      expect(result.current.isInitialLoad).toBe(false);
    });

    it("shows no placeholders over a page that is already cached", () => {
      const { result } = setup({ active: [], isFetching: true });

      expect(result.current.isLoadingDeployments).toBe(true);
      expect(result.current.isInitialLoad).toBe(false);
    });

    it("reports an initial load even before the query reports itself as fetching", () => {
      const { result } = setup({ isUnresolved: true, isFetching: false });

      expect(result.current.isInitialLoad).toBe(true);
    });

    it("reports no initial load before there is an account to query", () => {
      const { result } = setup({ isUnresolved: true, isFetching: true, address: "" });

      expect(result.current.isInitialLoad).toBe(false);
    });

    it("stops reporting an initial load once a page has resolved", () => {
      const { result } = setup({ active: [deployment("100")] });

      expect(result.current.isInitialLoad).toBe(false);
    });

    it("leaves a search to the progress bar rather than a second round of placeholders", async () => {
      const { result, rerenderWith } = setup({ active: [deployment("100")] });

      await act(async () => result.current.changeSearch("acme"));
      rerenderWith({ isFetching: true });

      expect(result.current.isLoadingDeployments).toBe(true);
      expect(result.current.isInitialLoad).toBe(false);
    });

    it("stops reporting an initial load when the first page fails instead of resolving", () => {
      const { result } = setup({ isUnresolved: true, isError: true });

      expect(result.current.isInitialLoad).toBe(false);
    });

    it("reports no paging when every deployment fits on the first page", () => {
      const { result } = setup({ active: [deployment("100")], hasNextPage: false });

      expect(result.current.isPaginated).toBe(false);
    });

    it("reports paging once there is a page to move to", () => {
      const { result } = setup({ active: [deployment("100")], hasNextPage: true });

      expect(result.current.isPaginated).toBe(true);
    });

    it("hides the rows-per-page selector while the page size is the default one everything fits under", () => {
      const { result } = setup({ active: [deployment("100")], hasNextPage: false });

      expect(result.current.isPaginated).toBe(false);
      expect(result.current.showPageSizeSelector).toBe(false);
    });

    it("keeps the rows-per-page selector reachable after a larger page size swallowed the pager", async () => {
      const { result } = setup({ active: [deployment("100")], hasNextPage: false });

      await act(async () => result.current.changePageSize(50));

      expect(result.current.isPaginated).toBe(false);
      expect(result.current.showPageSizeSelector).toBe(true);
    });

    it("hides the rows-per-page selector when there are no rows to size", async () => {
      const { result } = setup({ active: [], archived: [] });

      await act(async () => result.current.changePageSize(50));

      expect(result.current.showPageSizeSelector).toBe(false);
    });

    it("offers the rows-per-page selector to an account whose only paged rows are closed ones", () => {
      const { result } = setup({ active: [], archived: closedDeployments(DEFAULT_PAGE_SIZE + 1) });

      expect(result.current.hasPageResults).toBe(false);
      expect(result.current.isArchivePaginated).toBe(true);
      expect(result.current.showPageSizeSelector).toBe(true);
    });

    it("keeps that selector reachable once a larger size has swallowed the archive's pager", async () => {
      const { result } = setup({ active: [], archived: closedDeployments(DEFAULT_PAGE_SIZE + 1) });

      await act(async () => result.current.changePageSize(50));

      expect(result.current.isArchivePaginated).toBe(false);
      expect(result.current.showPageSizeSelector).toBe(true);
    });

    it("keeps reporting paging on the last page, where there is nowhere further to go", async () => {
      const { result } = setup({ activeByPage: { 0: [deployment("100")], 1: [deployment("101")] }, hasNextPage: false });

      await act(async () => result.current.goToNextPage());

      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.isPaginated).toBe(true);
    });

    it("keeps counting the account as having deployments when a search matches nothing", async () => {
      const { result, rerenderWith } = setup({ active: [deployment("100")] });

      await act(async () => result.current.changeSearch("no-such-deployment"));
      rerenderWith({ active: [], archived: [] });

      expect(result.current.showNoSearchResults).toBe(true);
      expect(result.current.hasAnyDeployment).toBe(true);
    });

    it("offers the New deployment link to an account whose archive failed and so gets no empty state", () => {
      const { result } = setup({ active: [], isArchiveError: true });

      expect(result.current.hasSettledWithoutActiveDeployments).toBe(false);
      expect(result.current.showNewDeploymentLink).toBe(true);
    });

    it("offers the New deployment link when the active query failed", () => {
      const { result } = setup({ active: [], isError: true });

      expect(result.current.showNewDeploymentLink).toBe(true);
    });

    it("leaves the New deployment link to the empty state for an account with nothing at all", () => {
      const { result } = setup({ active: [], archived: [] });

      expect(result.current.showNewDeploymentLink).toBe(false);
    });

    it("withholds the New deployment link until the first page has resolved", () => {
      const { result } = setup({ isUnresolved: true, isFetching: true });

      expect(result.current.showNewDeploymentLink).toBe(false);
    });

    it("offers the New deployment link to an account that has deployments", () => {
      const { result } = setup({ active: [deployment("100")] });

      expect(result.current.showNewDeploymentLink).toBe(true);
    });

    it("withholds the empty state until the archive query has settled", () => {
      const { result } = setup({ active: [], isArchiveUnresolved: true, isArchiveFetching: true });

      expect(result.current.hasSettledWithoutActiveDeployments).toBe(false);
    });

    it("withholds the empty state while the active query is still loading", () => {
      const { result } = setup({ isUnresolved: true, isFetching: true });

      expect(result.current.hasSettledWithoutActiveDeployments).toBe(false);
    });

    it("keeps the empty state on screen through a refresh rather than retracting it", () => {
      const { result } = setup({ active: [], archived: [], isFetching: true, isArchiveFetching: true });

      expect(result.current.isLoadingDeployments).toBe(true);
      expect(result.current.hasSettledWithoutActiveDeployments).toBe(true);
      expect(result.current.isInitialLoad).toBe(false);
    });

    it("shows the error state rather than the empty state when the query failed", () => {
      const { result } = setup({ active: [], isError: true });

      expect(result.current.showErrorState).toBe(true);
      expect(result.current.hasSettledWithoutActiveDeployments).toBe(false);
    });

    it("keeps the rows on screen when a refresh fails after a page already loaded", () => {
      const { result } = setup({ active: [deployment("100")], isError: true });

      expect(result.current.showErrorState).toBe(false);
    });

    it("holds the error state back while a retry is in flight", () => {
      const { result } = setup({ active: [], isError: true, isFetching: true });

      expect(result.current.showErrorState).toBe(false);
    });

    it("offers a retry rather than the onboarding state when the archive query failed", () => {
      const { result } = setup({ active: [], isArchiveError: true });

      expect(result.current.showArchiveError).toBe(true);
      expect(result.current.hasSettledWithoutActiveDeployments).toBe(false);
    });

    it("reports the archive failure even when the active page has rows of its own", () => {
      const { result } = setup({ active: [deployment("100")], isArchiveError: true });

      expect(result.current.showArchiveError).toBe(true);
      expect(result.current.showErrorState).toBe(false);
    });

    it("keeps the archive failure on screen while the retry is in flight", () => {
      const { result } = setup({ active: [], isArchiveError: true, isArchiveFetching: true });

      expect(result.current.showArchiveError).toBe(true);
      expect(result.current.isRetryingArchive).toBe(true);
    });

    it("reports no retry in flight for an archive that simply has not loaded yet", () => {
      const { result } = setup({ active: [], isArchiveFetching: true });

      expect(result.current.isRetryingArchive).toBe(false);
    });

    it("withholds the no-results message while the archive that would have matched never loaded", async () => {
      const { result, rerenderWith } = setup({ active: [deployment("100")], isArchiveError: true });

      await act(async () => result.current.changeSearch("nothing-matches-this"));
      rerenderWith({ active: [] });

      expect(result.current.showNoSearchResults).toBe(false);
      expect(result.current.showArchiveError).toBe(true);
    });

    it("withholds the no-results message until the archive that might match has loaded", async () => {
      const { result, rerenderWith } = setup({ active: [deployment("100")], isArchiveFetching: true });

      await act(async () => result.current.changeSearch("nothing-matches-this"));
      rerenderWith({ active: [] });

      expect(result.current.showNoSearchResults).toBe(false);
    });
  });

  describe("when the source has yet to apply the search in the box", () => {
    it("keeps the toolbar up rather than reading a cleared box as an account with nothing in it", () => {
      const { result } = setup({ active: [], archived: [], appliedSearch: "no-such-deployment" });

      expect(result.current.hasAnyDeployment).toBe(true);
      expect(result.current.hasSettledWithoutActiveDeployments).toBe(false);
    });

    it("keeps reporting the applied search's empty result until the source catches up", () => {
      const { result } = setup({ active: [], archived: [], appliedSearch: "no-such-deployment" });

      expect(result.current.showNoSearchResults).toBe(true);
    });
  });

  describe("when the api refuses a search as too broad", () => {
    it("says so instead of leaving the list to report a generic failure", () => {
      const { result } = setup({ active: [], archived: [], appliedSearch: "web", isSearchTooBroad: true });

      expect(result.current.showSearchTooBroad).toBe(true);
      expect(result.current.showErrorState).toBe(false);
      expect(result.current.showNoSearchResults).toBe(false);
    });

    it("keeps a refusal that only the archive hit out of the active list's message", () => {
      const { result } = setup({ active: [], archived: [], appliedSearch: "web", isArchiveSearchTooBroad: true });

      expect(result.current.showArchiveSearchTooBroad).toBe(true);
      expect(result.current.showSearchTooBroad).toBe(false);
      expect(result.current.showNoSearchResults).toBe(false);
    });
  });

  it("clears any staged SDL when a new deployment is started", () => {
    const { result, store } = setup({ active: [deployment("100")] });
    store.set(sdlStore.deploySdl, mock<TemplateCreation>());

    act(() => result.current.startNewDeployment());

    expect(store.get(sdlStore.deploySdl)).toBeNull();
  });

  function deployment(dseq: string, state = "active") {
    return mock<ListedDeploymentDto>({ dseq, state });
  }

  function closedDeployments(count: number) {
    return Array.from({ length: count }, (_, index) => deployment(`${200 + index}`, "closed"));
  }

  type Input = {
    active?: ListedDeploymentDto[];
    activeByPage?: Record<number, ListedDeploymentDto[]>;
    archived?: ListedDeploymentDto[];
    isUnresolved?: boolean;
    isArchiveUnresolved?: boolean;
    unknownArchiveTotal?: boolean;
    address?: string;
    hasNextPage?: boolean;
    isFetching?: boolean;
    isError?: boolean;
    isArchiveFetching?: boolean;
    isArchiveError?: boolean;
    isCloseConfirmed?: boolean;
    broadcastResponse?: boolean;
    appliedSearch?: string;
    isSearchTooBroad?: boolean;
    isArchiveSearchTooBroad?: boolean;
  };

  function setup(input: Input) {
    localStorage.clear();

    let current = input;
    const refetch = vi.fn();
    const closeDeploymentConfirm = vi.fn(async () => current.isCloseConfirmed ?? true);
    const signAndBroadcastTx = vi.fn(async () => ("broadcastResponse" in current ? (current.broadcastResponse as boolean) : true));
    const analyticsService = mock<AnalyticsService>();

    const useDeploymentsListSource = vi.fn(({ search, pageIndex, pageSize, archivePageIndex }: DeploymentsListSourceInput): DeploymentsListSource => {
      const archived = current.archived ?? [];

      return {
        appliedSearch: current.appliedSearch ?? search.trim(),
        active: {
          deployments: current.activeByPage ? current.activeByPage[pageIndex] ?? [] : current.active ?? [],
          hasNextPage: current.hasNextPage ?? false,
          isResolved: !current.isUnresolved,
          isFetching: current.isFetching ?? false,
          isError: current.isError ?? false,
          isSearchTooBroad: current.isSearchTooBroad ?? false
        },
        archive: {
          deployments: archived.slice(archivePageIndex * pageSize, (archivePageIndex + 1) * pageSize),
          total: current.unknownArchiveTotal ? null : archived.length,
          hasNextPage: (archivePageIndex + 1) * pageSize < archived.length,
          isResolved: !current.isArchiveUnresolved,
          isFetching: current.isArchiveFetching ?? false,
          isError: current.isArchiveError ?? false,
          isSearchTooBroad: current.isArchiveSearchTooBroad ?? false
        },
        refetch
      };
    });

    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
        address: current.address ?? "akash1owner",
        hasWallet: true,
        signAndBroadcastTx
      });
    const useProviderList: typeof DEPENDENCIES.useProviderList = () => mock<ReturnType<typeof DEPENDENCIES.useProviderList>>({ data: [], isFetching: false });
    const useManagedDeploymentConfirm: typeof DEPENDENCIES.useManagedDeploymentConfirm = () =>
      mock<ReturnType<typeof DEPENDENCIES.useManagedDeploymentConfirm>>({ closeDeploymentConfirm });

    const dependencies: typeof DEPENDENCIES = {
      useWallet,
      useProviderList,
      useManagedDeploymentConfirm,
      useListSelection: DEPENDENCIES.useListSelection,
      useDeploymentsListSource
    };

    const store = createStore();
    const hook = renderHook(() => useDeploymentsListModel(dependencies), {
      wrapper: ({ children }) => (
        <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
          <Provider store={store}>{children}</Provider>
        </TestContainerProvider>
      )
    });

    return {
      ...hook,
      store,
      rerenderWith(next: Partial<Input>) {
        current = { ...current, ...next };
        hook.rerender();
      },
      refetch,
      closeDeploymentConfirm,
      signAndBroadcastTx,
      analyticsService,
      useDeploymentsListSource
    };
  }
});
