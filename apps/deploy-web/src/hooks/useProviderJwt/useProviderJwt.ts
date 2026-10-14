import { useCallback, useMemo } from "react";
import type { JwtTokenAccessScope } from "@akashnetwork/chain-sdk/web";
import { JwtTokenManager } from "@akashnetwork/chain-sdk/web";
import { useAtom } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import providerCredentialsStore from "@src/store/providerCredentialsStore";

export const REFRESH_SKEW_SECONDS = 60;

export const TOKEN_TTL_SECONDS = 30 * 60;

/** Providers authorize a deployment grant by dseq and scope alone, yet the token schema requires a non-empty service list. */
const EVERY_SERVICE = ["*"];

export const DEPENDENCIES = {
  useWallet,
  useUser,
  useServices
};

export function useProviderJwt({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): UseProviderJwtResult {
  const { consoleApiHttpClient } = d.useServices();
  const { hasWallet, address } = d.useWallet();
  const { user } = d.useUser();
  const userId = user?.id;
  const [issuedToken, setIssuedToken] = useAtom(providerCredentialsStore.issuedToken);
  const accessToken = issuedToken && issuedToken.userId === userId && issuedToken.address === address ? issuedToken.token : null;

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
    assertCanIssueToken(hasWallet, userId);

    const response = await consoleApiHttpClient.post<{ data: { token: string } }>("/v1/create-jwt-token", {
      data: {
        ttl: TOKEN_TTL_SECONDS,
        leases: {
          access: "scoped",
          scope: ["status", "shell", "events", "logs", "send-manifest", "get-manifest"]
        }
      }
    });
    const token = response.data.data.token;

    setIssuedToken({ userId, address, token });
    return token;
  }, [hasWallet, userId, address, consoleApiHttpClient, setIssuedToken]);

  const generateScopedProviderToken = useCallback(
    async ({ provider, scope }: { provider: string; scope: readonly string[] }): Promise<string> => {
      assertCanIssueToken(hasWallet, userId);

      const response = await consoleApiHttpClient.post<{ data: { token: string } }>("/v1/create-jwt-token", {
        data: {
          ttl: TOKEN_TTL_SECONDS,
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

  const generateDeploymentToken = useCallback(
    async ({ provider, dseqs, scope }: DeploymentTokenRequest): Promise<string> => {
      assertCanIssueToken(hasWallet, userId);

      const response = await consoleApiHttpClient.post<{ data: { token: string } }>("/v1/create-jwt-token", {
        data: {
          ttl: TOKEN_TTL_SECONDS,
          leases: {
            access: "granular",
            permissions: [{ provider, access: "granular", deployments: dseqs.map(dseq => ({ dseq: Number(dseq), scope, services: EVERY_SERVICE })) }]
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
      generateScopedProviderToken,
      generateDeploymentToken
    }),
    [accessToken, generateToken, generateScopedProviderToken, generateDeploymentToken]
  );
}

function assertCanIssueToken(hasWallet: boolean, userId: string | undefined): asserts userId is string {
  if (!hasWallet) {
    throw new Error("Cannot generate JWT: user has no wallet");
  }
  if (!userId) {
    throw new Error("Cannot generate JWT: user is not authenticated");
  }
}

export type DeploymentTokenRequest = {
  provider: string;
  dseqs: readonly string[];
  scope: readonly JwtTokenAccessScope[];
};

export interface UseProviderJwtResult {
  isTokenExpired: boolean;
  accessToken: string | null;
  generateToken: () => Promise<string>;
  /** A single-provider token for one call, such as an attestation quote, which never replaces the shared token. */
  generateScopedProviderToken: (params: { provider: string; scope: readonly string[] }) => Promise<string>;
  generateDeploymentToken: (params: DeploymentTokenRequest) => Promise<string>;
}
