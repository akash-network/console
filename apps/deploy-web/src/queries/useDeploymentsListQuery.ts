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
}

const EMPTY_PAGE: DeploymentsListPage = { deployments: [], total: 0, hasNextPage: false };

/** A wallet the console has not finished provisioning has no deployments rather than a failure to report. */
const MISSING_WALLET_STATUSES = [403, 404];

/**
 * One page of the signed-in user's deployments, already carrying their leases and what the console records
 * about them. The API resolves the wallet from the caller, so no address is passed.
 */
export function useDeploymentsListQuery(params: { state: DeploymentStatus; search: string; skip: number; limit: number }, options?: { enabled?: boolean }) {
  const { api } = useServices();
  const search = params.search.trim();

  return api.v1.listDeployments.useQuery(
    { state: params.state, reverse: "true", skip: params.skip, limit: params.limit, ...(search ? { search } : {}) },
    {
      enabled: options?.enabled ?? true,
      placeholderData: keepPreviousData,
      catchError: recoverMissingWalletAsEmptyPage,
      select: toDeploymentsListPage
    }
  );
}

function recoverMissingWalletAsEmptyPage(error: unknown) {
  if (error instanceof ApiError && MISSING_WALLET_STATUSES.includes(error.status)) return null;
  throw error;
}

function toDeploymentsListPage(
  response: { data: { deployments: unknown[]; pagination: { total: number | null; hasMore: boolean } } } | null
): DeploymentsListPage {
  if (!response) return EMPTY_PAGE;

  return {
    deployments: response.data.deployments.map(item => listedDeploymentToDto(item as Parameters<typeof listedDeploymentToDto>[0])),
    total: response.data.pagination.total,
    hasNextPage: response.data.pagination.hasMore
  };
}
