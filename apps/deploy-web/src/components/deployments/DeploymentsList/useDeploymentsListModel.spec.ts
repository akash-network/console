import { createElement } from "react";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentsPage } from "@src/queries/useDeploymentQuery";
import sdlStore from "@src/store/sdlStore";
import type { TemplateCreation } from "@src/types";
import type { DeploymentDto } from "@src/types/deployment";
import { DEFAULT_PAGE_SIZE, DEPENDENCIES, useDeploymentsListModel } from "./useDeploymentsListModel";

import { act, renderHook, waitFor } from "@testing-library/react";

describe(useDeploymentsListModel.name, () => {
  it("pages the active deployments server side while nobody is searching", () => {
    const { useDeploymentsPage } = setup({ active: [deployment("100")] });

    expect(useDeploymentsPage).toHaveBeenCalledWith(
      "akash1owner",
      { state: "active", skip: 0, limit: DEFAULT_PAGE_SIZE },
      expect.objectContaining({ enabled: true })
    );
  });

  it("leaves every query disabled until an address is known", () => {
    const { useDeploymentsPage, useDeploymentList } = setup({ address: "" });

    expect(useDeploymentsPage).toHaveBeenCalledWith("", expect.anything(), expect.objectContaining({ enabled: false }));
    expect(useDeploymentList).toHaveBeenCalledWith("", expect.objectContaining({ enabled: false }), "closed");
  });

  it("fetches the archive whole, since the chain API reports no total for the count", () => {
    const { useDeploymentList } = setup({ archived: [deployment("200", "closed")] });

    expect(useDeploymentList).toHaveBeenCalledWith("akash1owner", expect.objectContaining({ enabled: true }), "closed");
  });

  it("attaches the local name to each deployment", () => {
    const { result } = setup({ active: [deployment("100")], names: { "100": "acme-storefront" } });

    expect(result.current.pageDeployments[0].name).toBe("acme-storefront");
  });

  describe("searching", () => {
    it("swaps the paged query for the full active list", async () => {
      const { result, useDeploymentList, useDeploymentsPage } = setup({ active: [deployment("100")] });

      await act(async () => result.current.changeSearch("acme"));

      expect(lastListCallFor(useDeploymentList, "active")).toEqual(["akash1owner", expect.objectContaining({ enabled: true }), "active"]);
      expect(useDeploymentsPage).toHaveBeenLastCalledWith("akash1owner", expect.anything(), expect.objectContaining({ enabled: false }));
    });

    it("treats whitespace as no search at all", async () => {
      const { result, useDeploymentList } = setup({ active: [deployment("100")] });

      await act(async () => result.current.changeSearch("   "));

      expect(result.current.isSearching).toBe(false);
      expect(lastListCallFor(useDeploymentList, "active")).toEqual(["akash1owner", expect.objectContaining({ enabled: false }), "active"]);
    });

    it("matches on the local name, case insensitively", async () => {
      const { result } = setup({
        active: [deployment("100"), deployment("101")],
        names: { "100": "Acme-Storefront", "101": "billing-worker" }
      });

      await act(async () => result.current.changeSearch("acme"));

      expect(result.current.pageDeployments.map(d => d.dseq)).toEqual(["100"]);
    });

    it("matches on the dseq for a deployment that was never named", async () => {
      const { result } = setup({ active: [deployment("100"), deployment("2002")] });

      await act(async () => result.current.changeSearch("2002"));

      expect(result.current.pageDeployments.map(d => d.dseq)).toEqual(["2002"]);
    });

    it("searches the archive alongside the active deployments", async () => {
      const { result } = setup({
        active: [deployment("100")],
        archived: [deployment("200", "closed"), deployment("201", "closed")],
        names: { "100": "acme", "200": "acme-old", "201": "unrelated" }
      });

      await act(async () => result.current.changeSearch("acme"));

      expect(result.current.archiveDeployments.map(d => d.dseq)).toEqual(["200"]);
    });

    it("pages the full list in memory once the server-side paging is out of play", async () => {
      const many = Array.from({ length: DEFAULT_PAGE_SIZE + 3 }, (_, index) => deployment(`${100 + index}`));
      const { result } = setup({ active: many });

      await act(async () => result.current.changeSearch("1"));
      expect(result.current.pageDeployments).toHaveLength(DEFAULT_PAGE_SIZE);
      expect(result.current.hasNextPage).toBe(true);

      await act(async () => result.current.goToNextPage());
      expect(result.current.pageDeployments).toHaveLength(3);
      expect(result.current.hasNextPage).toBe(false);
    });

    it("reports no results only when neither the active list nor the archive matched", async () => {
      const { result } = setup({ active: [deployment("100")], archived: [deployment("200", "closed")] });

      await act(async () => result.current.changeSearch("nothing-matches-this"));

      expect(result.current.showNoSearchResults).toBe(true);
    });

    it("keeps quiet about no results while the archive still has a match", async () => {
      const { result } = setup({ active: [deployment("100")], archived: [deployment("299", "closed")] });

      await act(async () => result.current.changeSearch("299"));

      expect(result.current.showNoSearchResults).toBe(false);
    });

    it("ignores the whitespace around a search term when matching", async () => {
      const { result } = setup({ active: [deployment("100"), deployment("101")], names: { "100": "acme", "101": "other" } });

      await act(async () => result.current.changeSearch("  acme  "));

      expect(result.current.pageDeployments.map(d => d.dseq)).toEqual(["100"]);
    });

    it("returns to the first page when the search changes", async () => {
      const many = Array.from({ length: DEFAULT_PAGE_SIZE + 1 }, (_, index) => deployment(`${100 + index}`));
      const { result } = setup({ active: many });

      await act(async () => result.current.changeSearch("1"));
      await act(async () => result.current.goToNextPage());
      expect(result.current.pageIndex).toBe(1);

      await act(async () => result.current.changeSearch("10"));

      expect(result.current.pageIndex).toBe(0);
    });
  });

  describe("paging", () => {
    it("follows the RPC next_key rather than guessing from the page size", () => {
      const { result } = setup({ active: [deployment("100")], hasNextPage: true });

      expect(result.current.hasNextPage).toBe(true);
    });

    it("reports no next page when the RPC reports none", () => {
      const { result } = setup({ active: [deployment("100")], hasNextPage: false });

      expect(result.current.hasNextPage).toBe(false);
    });

    it("requests the next offset once the reader pages forward", async () => {
      const { result, useDeploymentsPage } = setup({ active: [deployment("100")], hasNextPage: true });

      await act(async () => result.current.goToNextPage());

      expect(result.current.pageIndex).toBe(1);
      expect(useDeploymentsPage).toHaveBeenLastCalledWith(
        "akash1owner",
        { state: "active", skip: DEFAULT_PAGE_SIZE, limit: DEFAULT_PAGE_SIZE },
        expect.anything()
      );
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
      const { result, useDeploymentsPage } = setup({ active: [deployment("100")], hasNextPage: true });

      await act(async () => result.current.goToNextPage());
      await act(async () => result.current.changePageSize(50));

      expect(result.current.pageIndex).toBe(0);
      expect(result.current.pageSize).toBe(50);
      expect(useDeploymentsPage).toHaveBeenLastCalledWith("akash1owner", { state: "active", skip: 0, limit: 50 }, expect.anything());
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
      expect(result.current.archiveDeployments).toHaveLength(DEFAULT_PAGE_SIZE + 3);
      expect(result.current.hasNextArchivePage).toBe(true);
    });

    it("leaves an archive that fits on one page unpaged", () => {
      const { result } = setup({ archived: closedDeployments(DEFAULT_PAGE_SIZE) });

      expect(result.current.hasNextArchivePage).toBe(false);
      expect(result.current.isArchivePaginated).toBe(false);
    });

    it("hands out the next slice once the reader pages forward", async () => {
      const { result } = setup({ archived: closedDeployments(DEFAULT_PAGE_SIZE + 2) });

      await act(async () => result.current.goToNextArchivePage());

      expect(result.current.archivePageIndex).toBe(1);
      expect(result.current.archivePageDeployments).toHaveLength(2);
      expect(result.current.hasNextArchivePage).toBe(false);
    });

    it("never pages back past the first page", async () => {
      const { result } = setup({ archived: closedDeployments(3) });

      await act(async () => result.current.goToPreviousArchivePage());

      expect(result.current.archivePageIndex).toBe(0);
    });

    it("repages the archive from the top when the page size changes", async () => {
      const { result } = setup({ archived: closedDeployments(DEFAULT_PAGE_SIZE + 5) });

      await act(async () => result.current.goToNextArchivePage());
      await act(async () => result.current.changePageSize(50));

      expect(result.current.archivePageIndex).toBe(0);
      expect(result.current.archivePageDeployments).toHaveLength(DEFAULT_PAGE_SIZE + 5);
    });

    it("returns the archive to its first page when the search changes", async () => {
      const { result } = setup({ active: [deployment("100")], archived: closedDeployments(DEFAULT_PAGE_SIZE + 1) });

      await act(async () => result.current.goToNextArchivePage());
      await act(async () => result.current.changeSearch("closed"));

      expect(result.current.archivePageIndex).toBe(0);
    });

    it("falls back a page when the archive page has emptied out", async () => {
      const { result, rerenderWith } = setup({ archived: closedDeployments(DEFAULT_PAGE_SIZE + 1) });

      await act(async () => result.current.goToNextArchivePage());
      expect(result.current.archivePageIndex).toBe(1);

      rerenderWith({ archived: closedDeployments(DEFAULT_PAGE_SIZE) });

      await waitFor(() => expect(result.current.archivePageIndex).toBe(0));
    });

    it("stays put on an empty archive page while the query is still loading", async () => {
      const { result, rerenderWith } = setup({ archived: closedDeployments(DEFAULT_PAGE_SIZE + 1) });

      await act(async () => result.current.goToNextArchivePage());
      rerenderWith({ archived: [], isArchiveFetching: true });

      expect(result.current.archivePageIndex).toBe(1);
    });
  });

  describe("refreshing", () => {
    it("refreshes the paged query and the archive together", () => {
      const { result, refetchPage, refetchList } = setup({ active: [deployment("100")] });

      act(() => result.current.refetchDeployments());

      expect(refetchPage).toHaveBeenCalled();
      expect(refetchList).toHaveBeenCalled();
    });

    it("refreshes the full list instead of the paged query while searching", async () => {
      const { result, refetchPage, refetchList } = setup({ active: [deployment("100")] });

      await act(async () => result.current.changeSearch("acme"));
      act(() => result.current.refetchDeployments());

      expect(refetchPage).not.toHaveBeenCalled();
      expect(refetchList).toHaveBeenCalled();
    });
  });

  describe("closing the selected deployments", () => {
    it("signs one message per selected deployment and then clears the selection", async () => {
      const { result, signAndBroadcastTx, closeDeploymentConfirm, refetchPage } = setup({ active: [deployment("100"), deployment("101")] });

      act(() => result.current.selectItem({ id: "100", isShiftPressed: false }));
      act(() => result.current.selectItem({ id: "101", isShiftPressed: false }));
      await act(async () => await result.current.closeSelectedDeployments());

      expect(closeDeploymentConfirm).toHaveBeenCalledWith(["100", "101"]);
      expect(signAndBroadcastTx).toHaveBeenCalledWith([expect.anything(), expect.anything()]);
      expect(refetchPage).toHaveBeenCalled();
      expect(result.current.selectedItemIds).toEqual([]);
    });

    it("does nothing when the confirmation is declined", async () => {
      const { result, signAndBroadcastTx } = setup({ active: [deployment("100")], isCloseConfirmed: false });

      act(() => result.current.selectItem({ id: "100", isShiftPressed: false }));
      await act(async () => await result.current.closeSelectedDeployments());

      expect(signAndBroadcastTx).not.toHaveBeenCalled();
      expect(result.current.selectedItemIds).toEqual(["100"]);
    });

    it("keeps the selection when the transaction does not land", async () => {
      const { result, refetchPage } = setup({ active: [deployment("100")], broadcastResponse: false });

      act(() => result.current.selectItem({ id: "100", isShiftPressed: false }));
      await act(async () => await result.current.closeSelectedDeployments());

      expect(refetchPage).not.toHaveBeenCalled();
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
      rerenderWith({ active: [deployment("100")], isListFetching: true });

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

    it("keeps reporting paging on the last page, where there is nowhere further to go", async () => {
      const { result } = setup({ activeByPage: { 0: [deployment("100")], 1: [deployment("101")] }, hasNextPage: false });

      await act(async () => result.current.goToNextPage());

      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.isPaginated).toBe(true);
    });

    it("keeps counting the account as having deployments when a search matches nothing", async () => {
      const { result } = setup({ active: [deployment("100")], names: { "100": "billing-worker" } });

      await act(async () => result.current.changeSearch("no-such-deployment"));

      expect(result.current.showNoSearchResults).toBe(true);
      expect(result.current.hasAnyDeployment).toBe(true);
    });

    it("keeps counting the account as having deployments through the first keystroke, before the full list has fetched", async () => {
      const { result } = setup({ active: [deployment("100")], archived: [], isListUnresolved: true });

      await act(async () => result.current.changeSearch("a"));

      expect(result.current.pageDeployments).toEqual([]);
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

    it("reports the search error rather than the paged error while searching", async () => {
      const { result } = setup({ active: [deployment("100")], isError: false, isListError: true });

      await act(async () => result.current.changeSearch("acme"));

      expect(result.current.isError).toBe(true);
    });

    it("reports the search fetch rather than the paged fetch while searching", async () => {
      const { result } = setup({ active: [deployment("100")], isFetching: true, isListFetching: false });

      await act(async () => result.current.changeSearch("acme"));

      expect(result.current.isLoadingDeployments).toBe(false);
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
      const { result } = setup({ active: [deployment("100")], isArchiveError: true });

      await act(async () => result.current.changeSearch("nothing-matches-this"));

      expect(result.current.showNoSearchResults).toBe(false);
      expect(result.current.showArchiveError).toBe(true);
    });

    it("withholds the no-results message until the archive that might match has loaded", async () => {
      const { result } = setup({ active: [deployment("100")], isArchiveFetching: true });

      await act(async () => result.current.changeSearch("nothing-matches-this"));

      expect(result.current.showNoSearchResults).toBe(false);
    });
  });

  it("clears any staged SDL when a new deployment is started", () => {
    const { result, store } = setup({ active: [deployment("100")] });
    store.set(sdlStore.deploySdl, mock<TemplateCreation>());

    act(() => result.current.startNewDeployment());

    expect(store.get(sdlStore.deploySdl)).toBeNull();
  });

  function lastListCallFor(useDeploymentList: ReturnType<typeof vi.fn>, state: string) {
    return useDeploymentList.mock.calls.filter(call => call[2] === state).at(-1);
  }

  function deployment(dseq: string, state = "active") {
    return mock<DeploymentDto>({ dseq, state });
  }

  type Input = {
    active?: DeploymentDto[];
    isUnresolved?: boolean;
    isListUnresolved?: boolean;
    isArchiveUnresolved?: boolean;
    activeByPage?: Record<number, DeploymentDto[]>;
    archived?: DeploymentDto[];
    address?: string;
    hasNextPage?: boolean;
    isFetching?: boolean;
    isError?: boolean;
    isListError?: boolean;
    isListFetching?: boolean;
    isArchiveFetching?: boolean;
    isArchiveError?: boolean;
    isCloseConfirmed?: boolean;
    broadcastResponse?: boolean;
    names?: Record<string, string>;
  };

  function closedDeployments(count: number) {
    return Array.from({ length: count }, (_, index) => deployment(`${200 + index}`, "closed"));
  }

  function setup(input: Input) {
    localStorage.clear();

    let current = input;
    const refetchPage = vi.fn();
    const refetchList = vi.fn();
    const closeDeploymentConfirm = vi.fn(async () => current.isCloseConfirmed ?? true);
    const signAndBroadcastTx = vi.fn(async () => ("broadcastResponse" in current ? (current.broadcastResponse as boolean) : true));

    const useDeploymentsPage = vi.fn<typeof DEPENDENCIES.useDeploymentsPage>((_address, params) =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentsPage>>(), {
        data: current.isUnresolved
          ? undefined
          : ({
              deployments: current.activeByPage ? current.activeByPage[params.skip / params.limit] ?? [] : current.active ?? [],
              hasNextPage: current.hasNextPage ?? false
            } satisfies DeploymentsPage),
        isFetching: current.isFetching ?? false,
        isError: current.isError ?? false,
        refetch: refetchPage
      })
    );

    const useDeploymentList = vi.fn<typeof DEPENDENCIES.useDeploymentList>((_address, _options, state) =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentList>>(), {
        data:
          state === "closed" ? (current.isArchiveUnresolved ? undefined : current.archived ?? []) : current.isListUnresolved ? undefined : current.active ?? [],
        isFetching: state === "closed" ? current.isArchiveFetching ?? false : current.isListFetching ?? false,
        isError: state === "closed" ? current.isArchiveError ?? false : current.isListError ?? false,
        refetch: refetchList
      })
    );

    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
        address: current.address ?? "akash1owner",
        hasWallet: true,
        signAndBroadcastTx
      });
    const useProviderList: typeof DEPENDENCIES.useProviderList = () => mock<ReturnType<typeof DEPENDENCIES.useProviderList>>({ data: [], isFetching: false });
    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () =>
      mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>({ getDeploymentName: dseq => current.names?.[String(dseq)] ?? null });
    const useManagedDeploymentConfirm: typeof DEPENDENCIES.useManagedDeploymentConfirm = () =>
      mock<ReturnType<typeof DEPENDENCIES.useManagedDeploymentConfirm>>({ closeDeploymentConfirm });

    const dependencies = {
      useWallet,
      useProviderList,
      useLocalNotes,
      useManagedDeploymentConfirm,
      useDeploymentsPage,
      useDeploymentList,
      useListSelection: DEPENDENCIES.useListSelection
    };

    const store = createStore();
    const hook = renderHook(() => useDeploymentsListModel(dependencies), {
      wrapper: ({ children }) => createElement(Provider, { store }, children)
    });

    return {
      ...hook,
      store,
      rerenderWith(next: Partial<Input>) {
        current = { ...current, ...next };
        hook.rerender();
      },
      refetchPage,
      refetchList,
      closeDeploymentConfirm,
      signAndBroadcastTx,
      useDeploymentsPage,
      useDeploymentList
    };
  }
});
