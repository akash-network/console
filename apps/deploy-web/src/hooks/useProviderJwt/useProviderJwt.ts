import { useCallback, useMemo } from "react";
import { JwtTokenManager } from "@akashnetwork/chain-sdk/web";
import { atom, useAtom } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";

/** Held in memory only, because for half an hour the token opens a shell on any of the user's leases. */
const ISSUED_TOKEN_ATOM = atom<{ userId: string; token: string } | null>(null);

export const REFRESH_SKEW_SECONDS = 60;

export const DEPENDENCIES = {
  useWallet,
  useUser,
  useServices
};

export function useProviderJwt({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): UseProviderJwtResult {
  const { consoleApiHttpClient } = d.useServices();
  const { hasWallet } = d.useWallet();
  const { user } = d.useUser();
  const userId = user?.id;
  const [issuedToken, setIssuedToken] = useAtom(ISSUED_TOKEN_ATOM);
  const accessToken = issuedToken && issuedToken.userId === userId ? issuedToken.token : null;

  const jwtTokenManager = useMemo(
    () =>
      new JwtTokenManager({
        signArbitrary: () => {
          throw new Error("Cannot sign jwt token: managed wallet uses server-side signing");
        }
      }),
    []
  );
  const parsedToken = useMemo(() => {
    if (!accessToken) return null;
    return jwtTokenManager.decodeToken(accessToken);
  }, [accessToken, jwtTokenManager]);

  const generateToken = useCallback(async (): Promise<string> => {
    if (!hasWallet) {
      throw new Error("Cannot generate JWT: user has no wallet");
    }
    if (!userId) {
      throw new Error("Cannot generate JWT: user is not authenticated");
    }

    const response = await consoleApiHttpClient.post<{ data: { token: string } }>("/v1/create-jwt-token", {
      data: {
        ttl: 30 * 60,
        leases: {
          access: "scoped",
          scope: ["status", "shell", "events", "logs", "send-manifest", "get-manifest"]
        }
      }
    });
    const token = response.data.data.token;

    setIssuedToken({ userId, token });
    return token;
  }, [hasWallet, userId, consoleApiHttpClient, setIssuedToken]);

  const generateScopedProviderToken = useCallback(
    async ({ provider, scope }: { provider: string; scope: readonly string[] }): Promise<string> => {
      if (!hasWallet) {
        throw new Error("Cannot generate JWT: user has no wallet");
      }
      if (!userId) {
        throw new Error("Cannot generate JWT: user is not authenticated");
      }

      const response = await consoleApiHttpClient.post<{ data: { token: string } }>("/v1/create-jwt-token", {
        data: {
          ttl: 30 * 60,
          leases: {
            access: "granular",
            permissions: [{ provider, access: "scoped", scope }]
          }
        }
      });

      return response.data.data.token;
    },
    [hasWallet, userId, consoleApiHttpClient]
  );

  return useMemo(
    () => ({
      get isTokenExpired() {
        return !!parsedToken && parsedToken.exp - REFRESH_SKEW_SECONDS <= Math.floor(Date.now() / 1000);
      },
      accessToken,
      generateToken,
      generateScopedProviderToken
    }),
    [accessToken, generateToken, generateScopedProviderToken]
  );
}

export interface UseProviderJwtResult {
  isTokenExpired: boolean;
  accessToken: string | null;
  generateToken: () => Promise<string>;
  /** A single-provider token for one call, such as an attestation quote, which never replaces the shared token. */
  generateScopedProviderToken: (params: { provider: string; scope: readonly string[] }) => Promise<string>;
}
