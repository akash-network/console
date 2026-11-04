import { useCallback, useMemo } from "react";
import type { JwtTokenAccessScope } from "@akashnetwork/chain-sdk/web";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";

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
  const { hasWallet } = d.useWallet();
  const { user } = d.useUser();
  const userId = user?.id;

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

  return useMemo(() => ({ generateScopedProviderToken, generateDeploymentToken }), [generateScopedProviderToken, generateDeploymentToken]);
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
  /** A token for every lease of the owner at the one provider named, limited to the actions named. */
  generateScopedProviderToken: (params: { provider: string; scope: readonly string[] }) => Promise<string>;
  generateDeploymentToken: (params: DeploymentTokenRequest) => Promise<string>;
}
