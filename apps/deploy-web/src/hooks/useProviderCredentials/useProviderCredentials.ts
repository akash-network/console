import { useCallback, useMemo } from "react";

import { useCertificate } from "@src/context/CertificateProvider";
import { useSettings } from "@src/context/SettingsProvider";
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
  const { createCertificate, isLocalCertExpired, isLocalCertMatching, localCert } = useCertificate();
  const { accessToken, generateToken, isTokenExpired } = useProviderJwt();

  const generate = useCallback(() => {
    return settings.isBlockchainDown ? generateToken() : createCertificate();
  }, [settings.isBlockchainDown, createCertificate, generateToken]);
  const credentials = useMemo(() => {
    return settings.isBlockchainDown
      ? ({
          type: "jwt",
          value: accessToken,
          isExpired: isTokenExpired,
          usable: !!accessToken && !isTokenExpired
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
          usable: !!localCert?.certPem && !!localCert?.keyPem && !isLocalCertExpired && isLocalCertMatching
        } as const);
  }, [settings.isBlockchainDown, localCert, accessToken, isLocalCertExpired, isLocalCertMatching, isTokenExpired]);

  return {
    details: credentials,
    generate
  };
}
