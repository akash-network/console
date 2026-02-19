import { describe, expect, it, type Mock, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ContextType as CertificateContextType } from "@src/context/CertificateProvider/CertificateProviderContext";
import type { SettingsContextType } from "@src/context/SettingsProvider";
import type { UseProviderJwtResult } from "../useProviderJwt/useProviderJwt";
import { DEPENDENCIES, useProviderCredentials } from "./useProviderCredentials";

import { setupQuery } from "@tests/unit/query-client";

describe(useProviderCredentials.name, () => {
  it("returns JWT credentials when blockchain is unavailable", () => {
    const accessToken = "jwt-token-123";
    const isTokenExpired = false;

    const { result } = setup({
      settings: { isBlockchainDown: true },
      providerJwt: { accessToken, isTokenExpired }
    });

    expect(result.current.details).toEqual({
      type: "jwt",
      value: accessToken,
      isExpired: isTokenExpired,
      usable: true
    });
    expect(typeof result.current.generate).toBe("function");
  });

  it("returns mTLS credentials when blockchain is up", () => {
    const localCert = {
      certPem: "cert-content",
      keyPem: "key-content",
      address: "akash123"
    };
    const isLocalCertExpired = false;
    const isLocalCertMatching = true;

    const { result } = setup({
      settings: { isBlockchainDown: false },
      certificate: { localCert, isLocalCertExpired, isLocalCertMatching }
    });

    expect(result.current.details).toEqual({
      type: "mtls",
      value: {
        cert: localCert.certPem,
        key: localCert.keyPem
      },
      isExpired: isLocalCertExpired,
      usable: true
    });
    expect(typeof result.current.generate).toBe("function");
  });

  it("returns unusable JWT credentials when token is expired", () => {
    const accessToken = "jwt-token-123";
    const isTokenExpired = true;

    const { result } = setup({
      settings: { isBlockchainDown: true },
      providerJwt: { accessToken, isTokenExpired }
    });

    expect(result.current.details.usable).toBe(false);
  });

  it("returns unusable JWT credentials when token is missing", () => {
    const { result } = setup({
      settings: { isBlockchainDown: true },
      providerJwt: { accessToken: null, isTokenExpired: false }
    });

    expect(result.current.details.usable).toBe(false);
  });

  it("returns unusable mTLS credentials when cert is expired", () => {
    const localCert = {
      certPem: "cert-content",
      keyPem: "key-content",
      address: "akash123"
    };
    const isLocalCertExpired = true;
    const isLocalCertMatching = true;

    const { result } = setup({
      settings: { isBlockchainDown: false },
      certificate: { localCert, isLocalCertExpired, isLocalCertMatching }
    });

    expect(result.current.details.usable).toBe(false);
  });

  it("returns unusable mTLS credentials when cert is missing", () => {
    const { result } = setup({
      settings: { isBlockchainDown: false },
      certificate: { localCert: null, isLocalCertExpired: false, isLocalCertMatching: true }
    });

    expect(result.current.details.usable).toBe(false);
  });

  it("returns unusable mTLS credentials when cert key is missing", () => {
    const localCert = {
      certPem: "cert-content",
      keyPem: "",
      address: "akash123"
    };
    const isLocalCertExpired = false;
    const isLocalCertMatching = true;

    const { result } = setup({
      settings: { isBlockchainDown: false },
      certificate: { localCert, isLocalCertExpired, isLocalCertMatching }
    });

    expect(result.current.details.usable).toBe(false);
  });

  it("returns unusable mTLS credentials when cert is not matching", () => {
    const localCert = {
      certPem: "cert-content",
      keyPem: "key-content",
      address: "akash123"
    };
    const isLocalCertExpired = false;
    const isLocalCertMatching = false;

    const { result } = setup({
      settings: { isBlockchainDown: false },
      certificate: { localCert, isLocalCertExpired, isLocalCertMatching }
    });

    expect(result.current.details.usable).toBe(false);
  });

  it("returns null mTLS value when cert is missing", () => {
    const { result } = setup({
      settings: { isBlockchainDown: false },
      certificate: { localCert: null, isLocalCertExpired: false, isLocalCertMatching: true }
    });

    expect(result.current.details.type).toBe("mtls");
    expect(result.current.details.value).toBeNull();
  });

  it("calls generateToken when blockchain is unavailable", async () => {
    const generateToken = vi.fn().mockResolvedValue(undefined);

    const { result } = setup({
      settings: { isBlockchainDown: true },
      providerJwt: { generateToken }
    });

    await result.current.generate();

    expect(generateToken).toHaveBeenCalledTimes(1);
  });

  it("calls createCertificate when blockchain is up", async () => {
    const createCertificate = vi.fn().mockResolvedValue(undefined);

    const { result } = setup({
      settings: { isBlockchainDown: false },
      certificate: { createCertificate }
    });

    await result.current.generate();

    expect(createCertificate).toHaveBeenCalledTimes(1);
  });

  function setup(input?: {
    settings?: Partial<SettingsContextType["settings"]>;
    certificate?: Partial<CertificateContextType>;
    providerJwt?: { accessToken?: string | null; isTokenExpired?: boolean; generateToken?: Mock };
  }) {
    return setupQuery(() =>
      useProviderCredentials({
        dependencies: {
          ...DEPENDENCIES,
          useSettings: () =>
            mock<SettingsContextType>({
              settings: {
                isBlockchainDown: false,
                ...input?.settings
              }
            }),
          useCertificate: () =>
            mock<CertificateContextType>({
              isLocalCertExpired: false,
              isLocalCertMatching: true,
              localCert: null,
              ...input?.certificate
            }),
          useProviderJwt: () =>
            mock<UseProviderJwtResult>({
              accessToken: null,
              isTokenExpired: false,
              ...input?.providerJwt
            })
        }
      })
    );
  }
});
