import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JwtTokenAccessScope } from "@akashnetwork/chain-sdk/web";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ExponentialBackoff, handleAll, retry } from "cockatiel";

import { isLimitedToProjects } from "@src/components/organizations/organizationAccess";
import type { ActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useWallet } from "@src/context/WalletProvider";
import { isClientError, SKIP_REPORTING_BELOW_SERVER_ERROR } from "@src/services/query-error-policy/query-error-policy";
import type { UseProviderJwtResult } from "../useProviderJwt/useProviderJwt";
import { REFRESH_SKEW_SECONDS, TOKEN_TTL_SECONDS, useProviderJwt } from "../useProviderJwt/useProviderJwt";

export const DEPENDENCIES = {
  useWallet,
  useProviderJwt,
  useActiveOrganization,
  useQueryClient
};

const GENERATE_TOKEN_RETRY_POLICY = retry(handleAll, {
  maxAttempts: 3,
  backoff: new ExponentialBackoff({
    initialDelay: 500,
    maxDelay: 5000
  })
});

export const LEASE_STATUS_SCOPE: readonly JwtTokenAccessScope[] = ["status"];

export const LEASE_LOGS_SCOPE: readonly JwtTokenAccessScope[] = ["logs", "events"];

export const LEASE_SHELL_SCOPE: readonly JwtTokenAccessScope[] = ["shell"];

export const LEASE_ATTESTATION_SCOPE: readonly JwtTokenAccessScope[] = ["attestation"];

/** The only actions the API grants a team viewer, none of which changes a lease. */
const LEASE_READ_SCOPE: readonly JwtTokenAccessScope[] = ["status", "events", "logs"];

/** Wide enough for every call at one provider to share a token, so a page polling many leases mints once per provider. */
const PROVIDER_WIDE_SCOPE: readonly JwtTokenAccessScope[] = ["status", "shell", "events", "logs", "send-manifest", "get-manifest"];

const PROVIDER_TOKEN_QUERY_KEY = "PROVIDER_TOKEN";

const DEPLOYMENT_TOKEN_QUERY_KEY = "PROVIDER_DEPLOYMENT_TOKEN";

/** `read-only` gets per-deployment tokens that only read leases, and `view-only` gets no token at all. */
export type ProviderTokenMode = "shared" | "per-deployment" | "read-only" | "view-only" | "pending" | "organization-unavailable";

/** Names what a token is for; a caller who reaches every project gets one token per provider for all of its leases there instead. */
export type LeaseAccess = {
  provider: string;
  dseqs: readonly string[];
  scope: readonly JwtTokenAccessScope[];
};

export type EnsureTokenOptions = { force?: boolean; access?: LeaseAccess };

export type UseProviderCredentialsResult = {
  details: {
    usable: boolean;
    error: Error | null;
  };
  tokenMode: ProviderTokenMode;
  ensureToken: (options?: EnsureTokenOptions) => Promise<string>;
};

export type UseProviderCredentialsDependencies = {
  dependencies?: typeof DEPENDENCIES;
};

type LeaseTokenRequest = {
  queryKeyOf: (access: LeaseAccess) => QueryKey;
  mint: (jwt: UseProviderJwtResult, access: LeaseAccess) => Promise<string>;
};

const PROVIDER_TOKEN_REQUEST: LeaseTokenRequest = {
  queryKeyOf: ({ provider }) => [PROVIDER_TOKEN_QUERY_KEY, provider],
  mint: (jwt, { provider }) => GENERATE_TOKEN_RETRY_POLICY.execute(() => jwt.generateScopedProviderToken({ provider, scope: PROVIDER_WIDE_SCOPE }))
};

const DEPLOYMENT_TOKEN_REQUEST: LeaseTokenRequest = {
  queryKeyOf: ({ provider, dseqs, scope }) => [DEPLOYMENT_TOKEN_QUERY_KEY, provider, [...dseqs].sort(), [...scope].sort()],
  mint: (jwt, access) => jwt.generateDeploymentToken(access)
};

export function useProviderCredentials({ dependencies: d = DEPENDENCIES }: UseProviderCredentialsDependencies = {}): UseProviderCredentialsResult {
  const { hasWallet, address } = d.useWallet();
  const jwt = d.useProviderJwt();
  const organization = d.useActiveOrganization();
  const queryClient = d.useQueryClient();
  const tokenMode = providerTokenModeOf(organization);
  const organizationId = organization.activeOrganization?.id;

  const isUsable = (tokenMode === "shared" || isPerDeployment(tokenMode)) && hasWallet;

  const [error, setError] = useState<Error | null>(null);

  const stateRef = useRef({ jwt, address, queryClient });
  stateRef.current = { jwt, address, queryClient };

  useEffect(() => {
    setError(null);
  }, [address]);

  const ensureCachedToken = useCallback(
    async (request: LeaseTokenRequest, options?: EnsureTokenOptions): Promise<string> => {
      const { jwt, queryClient, address } = stateRef.current;

      try {
        const token = await fetchLeaseToken({ queryClient, jwt, address, organizationId, request, options });
        setError(null);
        return token;
      } catch (err: unknown) {
        const normalizedError = err instanceof Error ? err : new Error(String(err));
        setError(normalizedError);
        throw normalizedError;
      }
    },
    [organizationId]
  );

  const ensureProviderToken = useCallback((options?: EnsureTokenOptions) => ensureCachedToken(PROVIDER_TOKEN_REQUEST, options), [ensureCachedToken]);

  const ensureDeploymentToken = useCallback((options?: EnsureTokenOptions) => ensureCachedToken(DEPLOYMENT_TOKEN_REQUEST, options), [ensureCachedToken]);

  const ensureReadOnlyDeploymentToken = useCallback(
    async (options?: EnsureTokenOptions): Promise<string> =>
      options?.access && !canRequestScope("read-only", options.access.scope) ? refuseViewOnly() : ensureDeploymentToken(options),
    [ensureDeploymentToken]
  );

  const ensureToken = {
    shared: ensureProviderToken,
    "per-deployment": ensureDeploymentToken,
    "read-only": ensureReadOnlyDeploymentToken,
    "view-only": refuseViewOnly,
    pending: refuseUntilKnown,
    "organization-unavailable": refuseUntilKnown
  }[tokenMode];

  const details = useMemo(() => ({ usable: isUsable, error }), [isUsable, error]);

  return useMemo(
    () => ({
      details,
      tokenMode,
      ensureToken
    }),
    [details, tokenMode, ensureToken]
  );
}

export function providerTokenModeOf({
  activeOrganization,
  isLoading,
  isError
}: Pick<ActiveOrganization, "activeOrganization" | "isLoading" | "isError">): ProviderTokenMode {
  if (isError && !activeOrganization) return "organization-unavailable";
  if (!activeOrganization) return isLoading ? "pending" : "shared";
  if (!isLimitedToProjects(activeOrganization)) return "shared";

  if (activeOrganization.role === "member") return "per-deployment";

  return activeOrganization.role === "viewer" ? "read-only" : "view-only";
}

/** Whether a token for these lease actions may be asked for at all, so views can say so instead of failing. */
export function canRequestScope(tokenMode: ProviderTokenMode, scope: readonly JwtTokenAccessScope[]): boolean {
  if (tokenMode === "view-only") return false;
  if (tokenMode === "read-only") return scope.every(action => LEASE_READ_SCOPE.includes(action));

  return true;
}

/** Status the caller may not read, so views should neither wait on it nor blame the provider for it. */
export function isLeaseStatusWithheld(tokenMode: ProviderTokenMode, polls: readonly { error: unknown }[]): boolean {
  return tokenMode === "view-only" || (isPerDeployment(tokenMode) && polls.some(poll => isClientError(poll.error)));
}

function isPerDeployment(tokenMode: ProviderTokenMode): boolean {
  return tokenMode === "per-deployment" || tokenMode === "read-only";
}

function refuseViewOnly(): Promise<string> {
  return Promise.reject(new Error("Cannot generate JWT: view-only access"));
}

function refuseUntilKnown(): Promise<string> {
  return Promise.reject(new Error("Cannot generate JWT: the active organization is not known yet"));
}

/** A refusal is kept for its token until forced or the organization changes, so polls do not ask again and again. */
async function fetchLeaseToken({
  queryClient,
  jwt,
  address,
  organizationId,
  request,
  options
}: {
  queryClient: QueryClient;
  jwt: UseProviderJwtResult;
  address: string | undefined;
  organizationId: string | undefined;
  request: LeaseTokenRequest;
  options?: EnsureTokenOptions;
}): Promise<string> {
  const access = options?.access;
  if (!access) throw new Error("Cannot generate JWT: no deployment named");

  const queryKey = [...request.queryKeyOf(access), organizationId, address];
  const previous = queryClient.getQueryState(queryKey);
  if (!options?.force && previous?.status === "error" && isClientError(previous.error)) throw previous.error;

  return queryClient.fetchQuery({
    queryKey,
    queryFn: () => request.mint(jwt, access),
    staleTime: options?.force ? 0 : (TOKEN_TTL_SECONDS - REFRESH_SKEW_SECONDS) * 1000,
    gcTime: TOKEN_TTL_SECONDS * 1000,
    meta: SKIP_REPORTING_BELOW_SERVER_ERROR
  });
}
