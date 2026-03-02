import { useCallback, useMemo } from "react";

import { useSettings } from "@src/context/SettingsProvider";
import { useCertificate } from "@src/hooks/useCertificate/useCertificate";
import type { ProviderCredentials } from "@src/services/provider-proxy/provider-proxy.service";
import { useProviderJwt } from "../useProviderJwt/useProviderJwt";

export const DEPENDENCIES = {
  useSettings,
  useCertificate,
  useProviderJwt
};

export type UseProviderCredentialsResult = {
  details: ProviderCredentials & {
    isExpired: boolean;
    usable: boolean;
  };
  generate: () => Promise<void>;
};

export type UseProviderCredentialsDependencies = {
  dependencies?: typeof DEPENDENCIES;
};

export function useProviderCredentials({ dependencies: d = DEPENDENCIES }: UseProviderCredentialsDependencies = {}): UseProviderCredentialsResult {
  const { settings } = d.useSettings();
  const { createCertificate, isLocalCertExpired, isLocalCertMatching, localCert } = d.useCertificate();
  const { accessToken, generateToken, isTokenExpired } = d.useProviderJwt();

  const generate = useCallback(() => {
    return settings.isBlockchainDown ? generateToken() : createCertificate();
  }, [settings.isBlockchainDown, createCertificate, generateToken]);
  const isUsable = settings.isBlockchainDown
    ? !!accessToken && !isTokenExpired
    : !!localCert?.certPem && !!localCert?.keyPem && !isLocalCertExpired && isLocalCertMatching;
  const credentials = useMemo(() => {
    return settings.isBlockchainDown
      ? ({
          type: "jwt",
          value: accessToken,
          isExpired: isTokenExpired,
          usable: isUsable
        } as const)
      : ({
          type: "mtls",
          value:
            localCert?.certPem && localCert?.keyPem
              ? {
                  cert: localCert.certPem,
                  key: localCert.keyPem
                }
              : null,
          isExpired: isLocalCertExpired,
          usable: isUsable
        } as const);
  }, [settings.isBlockchainDown, isUsable]);

  return useMemo(
    () => ({
      details: credentials,
      generate
    }),
    [credentials, generate]
  );
}
