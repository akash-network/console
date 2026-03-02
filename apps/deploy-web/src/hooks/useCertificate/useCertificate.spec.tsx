import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useCertificate";
import { useCertificate } from "./useCertificate";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

vi.mock("@src/utils/walletUtils", () => ({
  getStorageWallets: vi.fn(() => []),
  updateWallet: vi.fn()
}));

describe(useCertificate.name, () => {
  it("returns initial state with no address", () => {
    const { result } = setup();

    expect(result.current.validCertificates).toEqual([]);
    expect(result.current.selectedCertificate).toBeNull();
    expect(result.current.localCert).toBeNull();
    expect(result.current.localCerts).toBeNull();
    expect(result.current.isLoadingCertificates).toBe(false);
    expect(result.current.isCreatingCert).toBe(false);
    expect(result.current.isLocalCertMatching).toBe(false);
    expect(result.current.isLocalCertExpired).toBe(false);
  });

  it("returns expected function types", () => {
    const { result } = setup();

    expect(typeof result.current.loadValidCertificates).toBe("function");
    expect(typeof result.current.loadLocalCert).toBe("function");
    expect(typeof result.current.createCertificate).toBe("function");
    expect(typeof result.current.regenerateCertificate).toBe("function");
    expect(typeof result.current.revokeCertificate).toBe("function");
    expect(typeof result.current.revokeAllCertificates).toBe("function");
    expect(typeof result.current.genNewCertificateIfLocalIsInvalid).toBe("function");
    expect(typeof result.current.updateSelectedCertificate).toBe("function");
    expect(typeof result.current.setSelectedCertificate).toBe("function");
    expect(typeof result.current.setLocalCert).toBe("function");
    expect(typeof result.current.setValidCertificates).toBe("function");
    expect(typeof result.current.setLocalCerts).toBe("function");
  });

  it("loads valid certificates when address changes", async () => {
    const mockCerts = [buildRawCertificate()];
    const certificatesService = {
      getAllCertificates: vi.fn().mockResolvedValue(mockCerts)
    };
    const certificateManager = {
      parsePem: vi.fn().mockResolvedValue(buildParsedPem()),
      generatePEM: vi.fn()
    };

    const { result } = setup({
      address: "akash1abc",
      isSettingsInit: true,
      certificatesService,
      certificateManager
    });

    await vi.waitFor(() => {
      expect(certificatesService.getAllCertificates).toHaveBeenCalledWith({ address: "akash1abc", state: "valid" });
    });

    await vi.waitFor(() => {
      expect(result.current.validCertificates.length).toBe(1);
    });
  });

  it("does not load certificates when settings not initialized", () => {
    const certificatesService = {
      getAllCertificates: vi.fn().mockResolvedValue([])
    };

    setup({
      address: "akash1abc",
      isSettingsInit: false,
      certificatesService
    });

    expect(certificatesService.getAllCertificates).not.toHaveBeenCalled();
  });

  it("does not load certificates when fallback is enabled", () => {
    const certificatesService = {
      getAllCertificates: vi.fn().mockResolvedValue([])
    };

    setup({
      address: "akash1abc",
      isSettingsInit: true,
      isFallbackEnabled: true,
      certificatesService
    });

    expect(certificatesService.getAllCertificates).not.toHaveBeenCalled();
  });

  it("shows snackbar on loadValidCertificates with showSnackbar=true", async () => {
    const enqueueSnackbar = vi.fn();
    const certificatesService = {
      getAllCertificates: vi.fn().mockResolvedValue([])
    };

    const { result } = setup({
      address: "akash1abc",
      isSettingsInit: true,
      certificatesService,
      enqueueSnackbar
    });

    await act(async () => {
      await result.current.loadValidCertificates(true);
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "success" }));
  });

  it("reports error and shows snackbar on loadValidCertificates failure", async () => {
    const enqueueSnackbar = vi.fn();
    const errorHandler = { reportError: vi.fn() };
    const certificatesService = {
      getAllCertificates: vi.fn().mockRejectedValue(new Error("network error"))
    };

    const { result } = setup({
      address: "akash1abc",
      isSettingsInit: true,
      certificatesService,
      errorHandler,
      enqueueSnackbar
    });

    await act(async () => {
      await result.current.loadValidCertificates(true);
    });

    expect(errorHandler.reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: expect.objectContaining({ category: "certificates" })
      })
    );
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
  });

  it("genNewCertificateIfLocalIsInvalid generates PEM when no parsed cert", async () => {
    const generatedPem = { cert: "new-cert", publicKey: "new-pub", privateKey: "new-key" };
    const certificateManager = {
      parsePem: vi.fn().mockResolvedValue(buildParsedPem()),
      generatePEM: vi.fn().mockResolvedValue(generatedPem)
    };

    const { result } = setup({
      address: "akash1abc",
      certificateManager
    });

    let pemResult: unknown;
    await act(async () => {
      pemResult = await result.current.genNewCertificateIfLocalIsInvalid();
    });

    expect(pemResult).toEqual(generatedPem);
    expect(certificateManager.generatePEM).toHaveBeenCalledWith("akash1abc");
  });

  function setup(input?: {
    address?: string;
    isSettingsInit?: boolean;
    isFallbackEnabled?: boolean;
    certificatesService?: { getAllCertificates: ReturnType<typeof vi.fn> };
    certificateManager?: { parsePem: ReturnType<typeof vi.fn>; generatePEM: ReturnType<typeof vi.fn> };
    errorHandler?: { reportError: ReturnType<typeof vi.fn> };
    enqueueSnackbar?: ReturnType<typeof vi.fn>;
  }) {
    const address = input?.address ?? "";
    const isSettingsInit = input?.isSettingsInit ?? false;
    const isFallbackEnabled = input?.isFallbackEnabled ?? false;
    const enqueueSnackbar = input?.enqueueSnackbar ?? vi.fn();

    const certificatesService = input?.certificatesService ?? { getAllCertificates: vi.fn().mockResolvedValue([]) };
    const certificateManager = input?.certificateManager ?? { parsePem: vi.fn().mockResolvedValue(null), generatePEM: vi.fn() };
    const errorHandler = input?.errorHandler ?? { reportError: vi.fn() };
    const analyticsService = { track: vi.fn() };

    const dependencies: typeof DEPENDENCIES = {
      useWallet: () =>
        mock({
          address,
          signAndBroadcastTx: vi.fn().mockResolvedValue(true)
        }),
      useSettings: () =>
        mock({
          isSettingsInit
        }),
      useSnackbar: () => ({
        enqueueSnackbar,
        closeSnackbar: vi.fn()
      }),
      useServices: () =>
        mock({
          certificatesService,
          certificateManager,
          errorHandler,
          analyticsService,
          chainApiHttpClient: { isFallbackEnabled }
        })
    } as unknown as typeof DEPENDENCIES;

    return setupQuery(
      () => useCertificate({ dependencies }),
      {
        wrapper: ({ children }) => {
          // eslint-disable-next-line react/jsx-no-useless-fragment
          return <>{children}</>;
        }
      }
    );
  }
});

function buildRawCertificate() {
  return {
    serial: "serial-1",
    certificate: {
      cert: btoa("parsed-cert-pem"),
      pubkey: "pubkey-1",
      state: "valid"
    }
  };
}

function buildParsedPem() {
  return {
    hSerial: "h-serial",
    sIssuer: "issuer",
    sSubject: "subject",
    sNotBefore: "2024-01-01",
    sNotAfter: "2030-01-01",
    issuedOn: new Date("2024-01-01"),
    expiresOn: new Date("2030-01-01")
  };
}
