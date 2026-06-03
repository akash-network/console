import { useCallback, useEffect, useMemo, useState } from "react";
import { JwtTokenManager } from "@akashnetwork/chain-sdk/web";
import { atom, useAtom } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";

const JWT_TOKEN_ATOM = atom<string | null>(null);

export const REFRESH_SKEW_SECONDS = 60;

export const DEPENDENCIES = {
  useWallet,
  useUser,
  useServices
};

export function useProviderJwt({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): UseProviderJwtResult {
  const { storedWalletsService, consoleApiHttpClient } = d.useServices();
  const { isWalletConnected } = d.useWallet();
  const { user } = d.useUser();
  const userId = user?.id;
  const [accessToken, setAccessToken] = useAtom(JWT_TOKEN_ATOM);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!userId) {
      setAccessToken(null);
      setIsHydrated(true);
      return;
    }
    const token = storedWalletsService.getStorageManagedWallet(userId)?.token;
    setAccessToken(token || null);
    setIsHydrated(true);
  }, [storedWalletsService, userId, setAccessToken]);

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
    if (!isWalletConnected) {
      throw new Error("Cannot generate JWT: wallet is not connected");
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

    storedWalletsService.updateStorageManagedWallet({ userId, token });
    setAccessToken(token);
    return token;
  }, [isWalletConnected, userId, consoleApiHttpClient, storedWalletsService, setAccessToken]);

  return useMemo(
    () => ({
      get isTokenExpired() {
        return !!parsedToken && parsedToken.exp - REFRESH_SKEW_SECONDS <= Math.floor(Date.now() / 1000);
      },
      accessToken,
      generateToken,
      isHydrated
    }),
    [accessToken, generateToken, isHydrated]
  );
}

export interface UseProviderJwtResult {
  isTokenExpired: boolean;
  accessToken: string | null;
  generateToken: () => Promise<string>;
  isHydrated: boolean;
}
