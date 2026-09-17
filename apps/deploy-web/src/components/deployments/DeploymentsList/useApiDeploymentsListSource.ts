"use client";
import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { usePacedValue } from "@src/hooks/usePacedValue/usePacedValue";
import type { DeploymentsListPage } from "@src/queries/useDeploymentsListQuery";
import { useDeploymentsListQuery } from "@src/queries/useDeploymentsListQuery";
import type { DeploymentsListSource, DeploymentsListSourceInput } from "./useDeploymentsListSource";

export const DEPENDENCIES = {
  useWallet,
  useQueryClient,
  useServices,
  useDeploymentsListQuery
};

/** A search spans the whole account server-side, so it is paced rather than sent on every keystroke. */
export const SEARCH_PACING = { wait: 400, maxWait: 1000 };

const EMPTY_PAGE: DeploymentsListPage = { deployments: [], total: 0, hasNextPage: false, isSearchTooBroad: false };

/** One request per slice, answering with the rows, their leases and what the console records about them. */
export function useApiDeploymentsListSource(
  { search, pageIndex, pageSize, archivePageIndex }: DeploymentsListSourceInput,
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): DeploymentsListSource {
  const d = dependencies;
  const { hasWallet } = d.useWallet();
  const queryClient = d.useQueryClient();
  const { api } = d.useServices();

  const pacedSearch = usePacedValue(search.trim(), SEARCH_PACING);

  const active = d.useDeploymentsListQuery({ state: "active", search: pacedSearch, skip: pageIndex * pageSize, limit: pageSize }, { enabled: hasWallet });
  const archive = d.useDeploymentsListQuery(
    { state: "closed", search: pacedSearch, skip: archivePageIndex * pageSize, limit: pageSize },
    { enabled: hasWallet }
  );

  const listKeyPrefix = useMemo(() => api.v1.listDeployments.getKey(), [api]);
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: listKeyPrefix });
  }, [queryClient, listKeyPrefix]);

  const activePage = active.data ?? EMPTY_PAGE;
  const archivePage = archive.data ?? EMPTY_PAGE;

  return {
    appliedSearch: pacedSearch,
    active: {
      deployments: activePage.deployments,
      hasNextPage: activePage.hasNextPage,
      isResolved: active.data !== undefined,
      isFetching: active.isFetching,
      isError: active.isError,
      isSearchTooBroad: activePage.isSearchTooBroad
    },
    archive: {
      deployments: archivePage.deployments,
      total: archivePage.total,
      hasNextPage: archivePage.hasNextPage,
      isResolved: archive.data !== undefined,
      isFetching: archive.isFetching,
      isError: archive.isError,
      isSearchTooBroad: archivePage.isSearchTooBroad
    },
    refetch
  };
}
