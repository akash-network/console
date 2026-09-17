import { ApiError } from "@akashnetwork/openapi-sdk";
import { keepPreviousData } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { DeploymentStatus, ListedDeploymentDto } from "@src/types/deployment";
import { listedDeploymentToDto } from "@src/utils/deploymentDetailUtils";

export interface DeploymentsListPage {
  deployments: ListedDeploymentDto[];
  /** Deployments in the requested state, or matching the search when there is one. Null when the api could not count them. */
  total: number | null;
  hasNextPage: boolean;
  /** The account holds more deployments than the api sweeps for a search, so it refused this one rather than answering it. */
  isSearchTooBroad: boolean;
}

const EMPTY_PAGE: DeploymentsListPage = { deployments: [], total: 0, hasNextPage: false, isSearchTooBroad: false };

const SEARCH_TOO_BROAD_PAGE: DeploymentsListPage = { deployments: [], total: null, hasNextPage: false, isSearchTooBroad: true };

/** A wallet the console has not finished provisioning has no deployments rather than a failure to report. */
const MISSING_WALLET_STATUSES = [403, 404];

/** The api documents 422 on this route as the answer to a search spanning more deployments than it will sweep. */
const SEARCH_REFUSED_STATUS = 422;

const SEARCH_TOO_BROAD = Symbol("search too broad");

/** The api resolves the wallet from the caller, so a page of the signed-in user's deployments needs no address. */
export function useDeploymentsListQuery(params: { state: DeploymentStatus; search: string; skip: number; limit: number }, options?: { enabled?: boolean }) {
  const { api } = useServices();
  const search = params.search.trim();

  return api.v1.listDeployments.useQuery(
    { state: params.state, reverse: "true", skip: params.skip, limit: params.limit, ...(search ? { search } : {}) },
    {
      enabled: options?.enabled ?? true,
      placeholderData: keepPreviousData,
      catchError: recoverExpectedRefusals,
      select: toDeploymentsListPage
    }
  );
}

function recoverExpectedRefusals(error: unknown) {
  if (error instanceof ApiError) {
    if (MISSING_WALLET_STATUSES.includes(error.status)) return null;
    if (error.status === SEARCH_REFUSED_STATUS) return SEARCH_TOO_BROAD;
  }

  throw error;
}

function toDeploymentsListPage(
  response: { data: { deployments: unknown[]; pagination: { total: number | null; hasMore: boolean } } } | null | typeof SEARCH_TOO_BROAD
): DeploymentsListPage {
  if (response === SEARCH_TOO_BROAD) return SEARCH_TOO_BROAD_PAGE;
  if (!response) return EMPTY_PAGE;

  return {
    deployments: response.data.deployments.map(item => listedDeploymentToDto(item as Parameters<typeof listedDeploymentToDto>[0])),
    total: response.data.pagination.total,
    hasNextPage: response.data.pagination.hasMore,
    isSearchTooBroad: false
  };
}
