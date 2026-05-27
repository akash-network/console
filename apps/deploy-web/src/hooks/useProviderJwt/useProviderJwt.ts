import { useCallback, useEffect, useMemo, useState } from "react";
import { JwtTokenManager, type JwtTokenPayload } from "@akashnetwork/chain-sdk/web";
import { atom, useAtom } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useSelectedChain } from "../useSelectedChain/useSelectedChain";

const JWT_TOKEN_ATOM = atom<string | null>(null);

export const REFRESH_SKEW_SECONDS = 60;

export const DEPENDENCIES = {
  useSelectedChain,
  useWallet,
  useServices
};

export function useProviderJwt({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): UseProviderJwtResult {
  const { storedWalletsService, networkStore, consoleApiHttpClient } = d.useServices();
  const { isManaged, address, isWalletConnected } = d.useWallet();
  const selectedChain = d.useSelectedChain();
  const selectedNetworkId = networkStore.useSelectedNetworkId();
  const [accessToken, setAccessToken] = useAtom(JWT_TOKEN_ATOM);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(false);
    const token = storedWalletsService.getStorageWallets(selectedNetworkId).find(w => w.address === address)?.token;
    setAccessToken(token || null);
    setIsHydrated(true);
  }, [storedWalletsService, selectedNetworkId, address]);

  const jwtTokenManager = useMemo(
    () =>
      new JwtTokenManager({
        signArbitrary: selectedChain
          ? selectedChain.signArbitrary
          : () => {
              throw new Error("Cannot sign jwt token: custodial wallet not found");
            }
      }),
    [selectedChain]
  );
  const parsedToken = useMemo(() => {
    if (!accessToken) return null;
    return jwtTokenManager.decodeToken(accessToken);
  }, [accessToken, jwtTokenManager]);

  const generateToken = useCallback(async (): Promise<string> => {
    if (!isWalletConnected) {
      throw new Error("Cannot generate JWT: wallet is not connected");
    }

    const leasesAccess: JwtTokenPayload["leases"] = {
      access: "scoped",
      scope: ["status", "shell", "events", "logs", "send-manifest", "get-manifest"]
    };
    const tokenLifetimeInSeconds = 30 * 60;
    let token: string;
    if (isManaged) {
      const response = await consoleApiHttpClient.post<{ data: { token: string } }>("/v1/create-jwt-token", {
        data: {
          ttl: tokenLifetimeInSeconds,
          leases: leasesAccess
        }
      });
      token = response.data.data.token;
    } else {
      const now = Math.floor(Date.now() / 1000);
      token = await jwtTokenManager.generateToken({
        version: "v1",
        iss: address,
        exp: now + tokenLifetimeInSeconds,
        iat: now,
        leases: leasesAccess
      });
    }

    storedWalletsService.updateWallet(address, w => ({ ...w, token }));
    setAccessToken(token);
    return token;
  }, [isWalletConnected, isManaged, selectedChain, jwtTokenManager, address, consoleApiHttpClient]);

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
