import { useCallback, useEffect, useMemo, useState } from "react";
import { ExponentialBackoff, handleAll, retry } from "cockatiel";

import { useWallet } from "@src/context/WalletProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import type { ProviderCredentials } from "@src/services/provider-proxy/provider-proxy.service";
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

const inFlightTracker: { current: { address: string; promise: Promise<string> } | null } = { current: null };

export type UseProviderCredentialsResult = {
  details: ProviderCredentials & {
    isExpired: boolean;
    usable: boolean;
    error: Error | null;
  };
  ensureToken: () => Promise<string>;
};

export type UseProviderCredentialsDependencies = {
  dependencies?: typeof DEPENDENCIES;
};

export function useProviderCredentials({ dependencies: d = DEPENDENCIES }: UseProviderCredentialsDependencies = {}): UseProviderCredentialsResult {
  const { isWalletConnected, address } = d.useWallet();
  const { accessToken, generateToken, isTokenExpired, isHydrated } = d.useProviderJwt();
  const notificator = d.useNotificator();

  const isUsable = !!accessToken && !isTokenExpired;

  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setError(null);
    if (inFlightTracker.current && inFlightTracker.current.address !== address) {
      inFlightTracker.current = null;
    }
  }, [address]);

  const ensureToken = useCallback(async (): Promise<string> => {
    if (accessToken && !isTokenExpired) return accessToken;
    if (inFlightTracker.current && inFlightTracker.current.address === address) {
      return inFlightTracker.current.promise;
    }

    const promise = GENERATE_TOKEN_RETRY_POLICY.execute(() => generateToken())
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
        if (inFlightTracker.current?.promise === promise) {
          inFlightTracker.current = null;
        }
      });
    inFlightTracker.current = { address, promise };
    return promise;
  }, [accessToken, isTokenExpired, generateToken, notificator, address]);

  useEffect(() => {
    if (!isWalletConnected || !isHydrated || isUsable || error || inFlightTracker.current) return;
    ensureToken().catch(() => {});
  }, [isWalletConnected, isHydrated, isUsable, error, ensureToken]);

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
