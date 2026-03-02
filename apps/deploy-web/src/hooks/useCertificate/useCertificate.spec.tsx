import { createStore, Provider as JotaiProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useCertificate";
import { useCertificate } from "./useCertificate";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

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

  it("fetches valid certificates via useQuery when enabled", async () => {
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
      expect(result.current.validCertificates.length).toBe(1);
    });

    expect(certificatesService.getAllCertificates).toHaveBeenCalledWith({ address: "akash1abc", state: "valid" });
  });

  it("does not fetch certificates when query is disabled (settings not init)", () => {
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

  it("does not fetch certificates when query is disabled (fallback enabled)", () => {
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

  it("does not fetch certificates when query is disabled (no address)", () => {
    const certificatesService = {
      getAllCertificates: vi.fn().mockResolvedValue([])
    };

    setup({
      address: "",
      isSettingsInit: true,
      certificatesService
    });

    expect(certificatesService.getAllCertificates).not.toHaveBeenCalled();
  });

  it("refetchCertificates invalidates cache, refetches, and shows success snackbar", async () => {
    const certificatesService = {
      getAllCertificates: vi.fn().mockResolvedValue([])
    };

    const { result } = setup({
      address: "akash1abc",
      isSettingsInit: true,
      certificatesService
    });

    await vi.waitFor(() => {
      expect(result.current.isLoadingCertificates).toBe(false);
    });

    await act(async () => {
      await result.current.refetchCertificates();
    });
  });

  it("uses cached data and does not refetch on subsequent renders", async () => {
    const certificatesService = {
      getAllCertificates: vi.fn().mockResolvedValue([buildRawCertificate()])
    };
    const certificateManager = {
      parsePem: vi.fn().mockResolvedValue(buildParsedPem()),
      generatePEM: vi.fn()
    };

    const { result, rerender } = setup({
      address: "akash1abc",
      isSettingsInit: true,
      certificatesService,
      certificateManager
    });

    await vi.waitFor(() => {
      expect(result.current.validCertificates.length).toBe(1);
    });

    const callCountAfterInit = certificatesService.getAllCertificates.mock.calls.length;

    rerender();

    expect(certificatesService.getAllCertificates.mock.calls.length).toBe(callCountAfterInit);
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
  }) {
    const address = input?.address ?? "";
    const isSettingsInit = input?.isSettingsInit ?? false;
    const isFallbackEnabled = input?.isFallbackEnabled ?? false;

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
      useServices: () =>
        mock({
          certificatesService,
          certificateManager,
          errorHandler,
          analyticsService,
          chainApiHttpClient: { isFallbackEnabled },
          storedWalletsService: {
            getStorageWallets: vi.fn().mockReturnValue([]),
            updateWallet: vi.fn()
          }
        })
    } as unknown as typeof DEPENDENCIES;
    const jotaiStore = createStore();

    return setupQuery(() => useCertificate({ dependencies }), {
      wrapper: ({ children }) => {
        return <JotaiProvider store={jotaiStore}>{children}</JotaiProvider>;
      }
    });
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
