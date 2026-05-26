import { useCallback, useEffect, useMemo, useRef } from "react";

import { useWallet } from "@src/context/WalletProvider";
import type { ProviderCredentials } from "@src/services/provider-proxy/provider-proxy.service";
import { useProviderJwt } from "../useProviderJwt/useProviderJwt";

export const DEPENDENCIES = {
  useWallet,
  useProviderJwt
};

export type UseProviderCredentialsResult = {
  details: ProviderCredentials & {
    isExpired: boolean;
    usable: boolean;
  };
  ensureToken: () => Promise<string>;
};

export type UseProviderCredentialsDependencies = {
  dependencies?: typeof DEPENDENCIES;
};

export function useProviderCredentials({ dependencies: d = DEPENDENCIES }: UseProviderCredentialsDependencies = {}): UseProviderCredentialsResult {
  const { isWalletConnected } = d.useWallet();
  const { accessToken, generateToken, isTokenExpired } = d.useProviderJwt();

  const isUsable = !!accessToken && !isTokenExpired;

  const inFlightRef = useRef<Promise<string> | null>(null);

  const ensureToken = useCallback(async (): Promise<string> => {
    if (accessToken && !isTokenExpired) return accessToken;
    if (inFlightRef.current) return inFlightRef.current;

    const promise = generateToken().finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = promise;
    return promise;
  }, [accessToken, isTokenExpired, generateToken]);

  useEffect(() => {
    if (!isWalletConnected || isUsable || inFlightRef.current) return;
    ensureToken().catch(() => {
      // Auto-refresh failures are surfaced by downstream provider calls
    });
  }, [isWalletConnected, isUsable, ensureToken]);

  const credentials = useMemo(
    () =>
      ({
        type: "jwt",
        value: accessToken,
        isExpired: isTokenExpired,
        usable: isUsable
      }) as const,
    [accessToken, isTokenExpired, isUsable]
  );

  return useMemo(
    () => ({
      details: credentials,
      ensureToken
    }),
    [credentials, ensureToken]
  );
}
