import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExponentialBackoff, handleAll, retry } from "cockatiel";
import { useSetAtom } from "jotai";

import { useWallet } from "@src/context/WalletProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import type { ProviderCredentials } from "@src/services/provider-proxy/provider-proxy.service";
import providerCredentialsStore from "@src/store/providerCredentialsStore";
import { useProviderJwt } from "../useProviderJwt/useProviderJwt";

export const DEPENDENCIES = {
  useWallet,
  useProviderJwt,
  useNotificator
};

const GENERATE_TOKEN_RETRY_POLICY = retry(handleAll, {
  maxAttempts: 3,
  backoff: new ExponentialBackoff({
    initialDelay: 500,
    maxDelay: 5000
  })
});

const GENERATE_TOKEN_FAILURE_MESSAGE = "Failed to authorize with the provider. Please retry.";

export type UseProviderCredentialsResult = {
  details: ProviderCredentials & {
    isExpired: boolean;
    usable: boolean;
    error: Error | null;
  };
  ensureToken: (options?: { force?: boolean }) => Promise<string>;
};

export type UseProviderCredentialsDependencies = {
  dependencies?: typeof DEPENDENCIES;
};

export function useProviderCredentials({ dependencies: d = DEPENDENCIES }: UseProviderCredentialsDependencies = {}): UseProviderCredentialsResult {
  const { hasWallet, address } = d.useWallet();
  const jwt = d.useProviderJwt();
  const { accessToken, isTokenExpired, isHydrated } = jwt;
  const notificator = d.useNotificator();

  const isUsable = !!accessToken && !isTokenExpired;

  const [error, setError] = useState<Error | null>(null);

  const claimInFlight = useSetAtom(providerCredentialsStore.claimInFlightTokenRequest);
  const releaseInFlight = useSetAtom(providerCredentialsStore.releaseInFlightTokenRequest);
  const clearInFlightForOtherAddress = useSetAtom(providerCredentialsStore.clearInFlightTokenRequestForOtherAddress);

  /**
   * Holds the jwt hook's result rather than its fields: `isTokenExpired` is a getter evaluated against the
   * current time, and reading it off a snapshot taken at render would answer for whenever that render was.
   */
  const stateRef = useRef({ jwt, notificator, address });
  stateRef.current = { jwt, notificator, address };

  useEffect(() => {
    setError(null);
    clearInFlightForOtherAddress(address);
  }, [address, clearInFlightForOtherAddress]);

  const ensureToken = useCallback(
    async (options?: { force?: boolean }): Promise<string> => {
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

  useEffect(() => {
    if (!hasWallet || !isHydrated || isUsable || error) return;
    ensureToken().catch(() => {});
  }, [hasWallet, isHydrated, isUsable, error, ensureToken]);

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
      ensureToken
    }),
    [credentials, ensureToken]
  );
}
