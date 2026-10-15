import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JwtTokenAccessScope } from "@akashnetwork/chain-sdk/web";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ExponentialBackoff, handleAll, retry } from "cockatiel";
import { useSetAtom } from "jotai";

import { isLimitedToProjects } from "@src/components/organizations/organizationAccess";
import type { ActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import type { ProviderCredentials } from "@src/services/provider-proxy/provider-proxy.service";
import { isClientError, SKIP_REPORTING_BELOW_SERVER_ERROR } from "@src/services/query-error-policy/query-error-policy";
import providerCredentialsStore from "@src/store/providerCredentialsStore";
import type { UseProviderJwtResult } from "../useProviderJwt/useProviderJwt";
import { REFRESH_SKEW_SECONDS, TOKEN_TTL_SECONDS, useProviderJwt } from "../useProviderJwt/useProviderJwt";

export const DEPENDENCIES = {
  useWallet,
  useProviderJwt,
  useNotificator,
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

const GENERATE_TOKEN_FAILURE_MESSAGE = "Failed to authorize with the provider. Please retry.";

export const LEASE_STATUS_SCOPE: readonly JwtTokenAccessScope[] = ["status"];

export const LEASE_LOGS_SCOPE: readonly JwtTokenAccessScope[] = ["logs", "events"];

export const LEASE_SHELL_SCOPE: readonly JwtTokenAccessScope[] = ["shell"];

export const LEASE_ATTESTATION_SCOPE: readonly JwtTokenAccessScope[] = ["attestation"];

/** The only actions the API grants a team viewer, none of which changes a lease. */
const LEASE_READ_SCOPE: readonly JwtTokenAccessScope[] = ["status", "events", "logs"];

const DEPLOYMENT_TOKEN_QUERY_KEY = "PROVIDER_DEPLOYMENT_TOKEN";

/** `read-only` gets per-deployment tokens that only read leases, and `view-only` gets no token at all. */
export type ProviderTokenMode = "shared" | "per-deployment" | "read-only" | "view-only" | "pending" | "organization-unavailable";

/** Names what a token is for; a caller who reaches every project gets one token for all of its leases instead. */
export type LeaseAccess = {
  provider: string;
  dseqs: readonly string[];
  scope: readonly JwtTokenAccessScope[];
};

export type EnsureTokenOptions = { force?: boolean; access?: LeaseAccess };

export type UseProviderCredentialsResult = {
  details: ProviderCredentials & {
    isExpired: boolean;
    usable: boolean;
    error: Error | null;
  };
  tokenMode: ProviderTokenMode;
  ensureToken: (options?: EnsureTokenOptions) => Promise<string>;
};

export type UseProviderCredentialsDependencies = {
  dependencies?: typeof DEPENDENCIES;
};

export function useProviderCredentials({ dependencies: d = DEPENDENCIES }: UseProviderCredentialsDependencies = {}): UseProviderCredentialsResult {
  const { hasWallet, address } = d.useWallet();
  const jwt = d.useProviderJwt();
  const { accessToken, isTokenExpired } = jwt;
  const notificator = d.useNotificator();
  const organization = d.useActiveOrganization();
  const queryClient = d.useQueryClient();
  const tokenMode = providerTokenModeOf(organization);
  const organizationId = organization.activeOrganization?.id;

  const isUsable = tokenMode === "shared" ? !!accessToken && !isTokenExpired : isPerDeployment(tokenMode) && hasWallet;

  const [error, setError] = useState<Error | null>(null);

  const claimInFlight = useSetAtom(providerCredentialsStore.claimInFlightTokenRequest);
  const releaseInFlight = useSetAtom(providerCredentialsStore.releaseInFlightTokenRequest);
  const clearInFlightForOtherAddress = useSetAtom(providerCredentialsStore.clearInFlightTokenRequestForOtherAddress);

  /**
   * Holds the jwt hook's result rather than its fields: `isTokenExpired` is a getter evaluated against the
   * current time, and reading it off a snapshot taken at render would answer for whenever that render was.
   */
  const stateRef = useRef({ jwt, notificator, address, queryClient });
  stateRef.current = { jwt, notificator, address, queryClient };

  useEffect(() => {
    setError(null);
    clearInFlightForOtherAddress(address);
  }, [address, clearInFlightForOtherAddress]);

  const ensureSharedToken = useCallback(
    async (options?: EnsureTokenOptions): Promise<string> => {
      const { jwt, notificator, address } = stateRef.current;
      if (!options?.force && jwt.accessToken && !jwt.isTokenExpired) return jwt.accessToken;

      return claimInFlight({
        address,
        createPromise: () => {
          const createdPromise: Promise<string> = GENERATE_TOKEN_RETRY_POLICY.execute(() => jwt.generateToken())
            .then(token => {
              setError(null);
              return token;
            })
            .catch((err: unknown) => {
              const normalizedError = err instanceof Error ? err : new Error(String(err));
              setError(normalizedError);
              notificator.error(GENERATE_TOKEN_FAILURE_MESSAGE);
              throw normalizedError;
            })
            .finally(() => {
              releaseInFlight(createdPromise);
            });
          return createdPromise;
        }
      });
    },
    [claimInFlight, releaseInFlight]
  );

  const ensureDeploymentToken = useCallback(
    async (options?: EnsureTokenOptions): Promise<string> => {
      const { jwt, queryClient, address } = stateRef.current;

      try {
        const token = await fetchDeploymentToken({ queryClient, jwt, address, organizationId, options });
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

  const ensureReadOnlyDeploymentToken = useCallback(
    async (options?: EnsureTokenOptions): Promise<string> =>
      options?.access && !canRequestScope("read-only", options.access.scope) ? refuseViewOnly() : ensureDeploymentToken(options),
    [ensureDeploymentToken]
  );

  const ensureToken = {
    shared: ensureSharedToken,
    "per-deployment": ensureDeploymentToken,
    "read-only": ensureReadOnlyDeploymentToken,
    "view-only": refuseViewOnly,
    pending: refuseUntilKnown,
    "organization-unavailable": refuseUntilKnown
  }[tokenMode];

  useEffect(() => {
    if (tokenMode !== "shared" || !hasWallet || isUsable || error) return;
    ensureSharedToken().catch(() => {});
  }, [tokenMode, hasWallet, isUsable, error, ensureSharedToken]);

  const credentials = useMemo(
    () =>
      ({
        type: "jwt",
        value: accessToken,
        isExpired: isTokenExpired,
        usable: isUsable,
        error
      }) as const,
    [accessToken, isTokenExpired, isUsable, error]
  );

  return useMemo(
    () => ({
      details: credentials,
      tokenMode,
      ensureToken
    }),
    [credentials, tokenMode, ensureToken]
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
async function fetchDeploymentToken({
  queryClient,
  jwt,
  address,
  organizationId,
  options
}: {
  queryClient: QueryClient;
  jwt: UseProviderJwtResult;
  address: string | undefined;
  organizationId: string | undefined;
  options?: EnsureTokenOptions;
}): Promise<string> {
  const access = options?.access;
  if (!access) throw new Error("Cannot generate JWT: no deployment named");

  const queryKey = [DEPLOYMENT_TOKEN_QUERY_KEY, organizationId, address, access.provider, [...access.dseqs].sort(), [...access.scope].sort()];
  const previous = queryClient.getQueryState(queryKey);
  if (!options?.force && previous?.status === "error" && isClientError(previous.error)) throw previous.error;

  return queryClient.fetchQuery({
    queryKey,
    queryFn: () => jwt.generateDeploymentToken(access),
    staleTime: options?.force ? 0 : (TOKEN_TTL_SECONDS - REFRESH_SKEW_SECONDS) * 1000,
    gcTime: TOKEN_TTL_SECONDS * 1000,
    meta: SKIP_REPORTING_BELOW_SERVER_ERROR
  });
}
