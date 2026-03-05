import type { AuthzHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SettingsContextType } from "@src/context/SettingsProvider/SettingsProviderContext";
import { SettingsProviderContext } from "@src/context/SettingsProvider/SettingsProviderContext";
import type { FallbackableHttpClient } from "@src/services/createFallbackableHttpClient/createFallbackableHttpClient";
import { useAllowancesGranted, useAllowancesIssued, useGranteeGrants, useGranterGrants } from "./useGrantsQuery";

import {} from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

const createMockSettingsContext = (): SettingsContextType =>
  mock({
    settings: {
      apiEndpoint: "https://api.example.com",
      rpcEndpoint: "https://rpc.example.com",
      isCustomNode: false,
      nodes: [],
      selectedNode: null,
      customNode: null,
      isBlockchainDown: false
    },
    setSettings: vi.fn(),
    isLoadingSettings: false,
    isSettingsInit: true,
    refreshNodeStatuses: vi.fn(),
    isRefreshingNodeStatus: false
  });

const MockSettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const mockSettings = createMockSettingsContext();

  return <SettingsProviderContext.Provider value={mockSettings}>{children}</SettingsProviderContext.Provider>;
};

describe("useGrantsQuery", () => {
  describe(useGranterGrants.name, () => {
    it("fetches granter grants when address is provided", async () => {
      const mockData = {
        grants: [
          {
            authorization: {
              "@type": "/akash.escrow.v1.DepositAuthorization"
            }
          }
        ],
        pagination: { total: 1 }
      };

      const authzHttpService = mock<AuthzHttpService>({
        isReady: true,
        getPaginatedDepositDeploymentGrants: vi.fn().mockResolvedValue(mockData)
      });
      const { result } = setupQuery(() => useGranterGrants("test-address", 0, 1000), {
        services: {
          authzHttpService: () => authzHttpService
        },
        wrapper: ({ children }) => <MockSettingsProvider>{children}</MockSettingsProvider>
      });

      await vi.waitFor(() => {
        expect(authzHttpService.getPaginatedDepositDeploymentGrants).toHaveBeenCalledWith({ granter: "test-address", limit: 1000, offset: 0 });
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when address is not provided", () => {
      const authzHttpService = mock<AuthzHttpService>({
        isReady: true,
        getPaginatedDepositDeploymentGrants: vi.fn().mockResolvedValue([])
      });
      setupQuery(() => useGranterGrants("", 0, 1000), {
        services: {
          authzHttpService: () => authzHttpService
        },
        wrapper: ({ children }) => <MockSettingsProvider>{children}</MockSettingsProvider>
      });

      expect(authzHttpService.getPaginatedDepositDeploymentGrants).not.toHaveBeenCalled();
    });
  });

  describe(useGranteeGrants.name, () => {
    it("fetches grantee grants when address is provided", async () => {
      const mockData = [
        {
          authorization: {
            "@type": "/akash.escrow.v1.DepositAuthorization"
          }
        }
      ];
      const authzHttpService = mock<AuthzHttpService>({
        isReady: true,
        getAllDepositDeploymentGrants: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useGranteeGrants("test-address"), {
        services: {
          authzHttpService: () => authzHttpService
        },
        wrapper: ({ children }) => <MockSettingsProvider>{children}</MockSettingsProvider>
      });

      await vi.waitFor(() => {
        expect(authzHttpService.getAllDepositDeploymentGrants).toHaveBeenCalledWith({ grantee: "test-address", limit: 1000 });
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when address is not provided", () => {
      const authzHttpService = mock<AuthzHttpService>({
        isReady: true,
        getAllDepositDeploymentGrants: vi.fn().mockResolvedValue([])
      });
      setupQuery(() => useGranteeGrants(""), {
        services: {
          authzHttpService: () => authzHttpService
        },
        wrapper: ({ children }) => <MockSettingsProvider>{children}</MockSettingsProvider>
      });

      expect(authzHttpService.getAllDepositDeploymentGrants).not.toHaveBeenCalled();
    });
  });

  describe(useAllowancesIssued.name, () => {
    it("fetches allowances issued when address is provided", async () => {
      const mockData = {
        allowances: [{ id: faker.string.uuid() }],
        pagination: { total: 1 }
      };
      const authzHttpService = mock<AuthzHttpService>({
        isReady: true,
        getPaginatedFeeAllowancesForGranter: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useAllowancesIssued("test-address", 0, 1000), {
        services: {
          authzHttpService: () => authzHttpService
        },
        wrapper: ({ children }) => <MockSettingsProvider>{children}</MockSettingsProvider>
      });

      await vi.waitFor(() => {
        expect(authzHttpService.getPaginatedFeeAllowancesForGranter).toHaveBeenCalledWith("test-address", 1000, 0);
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when address is not provided", () => {
      const authzHttpService = mock<AuthzHttpService>({
        isReady: true,
        getPaginatedFeeAllowancesForGranter: vi.fn().mockResolvedValue([])
      });
      setupQuery(() => useAllowancesIssued("", 0, 1000), {
        services: {
          authzHttpService: () => authzHttpService
        },
        wrapper: ({ children }) => <MockSettingsProvider>{children}</MockSettingsProvider>
      });

      expect(authzHttpService.getPaginatedFeeAllowancesForGranter).not.toHaveBeenCalled();
    });
  });

  describe(useAllowancesGranted.name, () => {
    it("fetches allowances granted when address is provided", async () => {
      const mockData = [{ id: faker.string.uuid() }];
      const chainApiHttpClient = mock<FallbackableHttpClient>({
        isFallbackEnabled: false,
        get: vi.fn().mockResolvedValue({
          data: {
            allowances: mockData,
            pagination: { next_key: null, total: mockData.length }
          }
        })
      } as any);

      const { result } = setupQuery(() => useAllowancesGranted("test-address"), {
        services: {
          chainApiHttpClient: () => chainApiHttpClient
        },
        wrapper: ({ children }) => <MockSettingsProvider>{children}</MockSettingsProvider>
      });

      await vi.waitFor(() => {
        expect(chainApiHttpClient.get).toHaveBeenCalledWith(
          expect.stringContaining("/cosmos/feegrant/v1beta1/allowances/test-address?pagination.limit=1000&pagination.count_total=true")
        );
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when address is not provided", () => {
      const chainApiHttpClient = mock<FallbackableHttpClient>({
        isFallbackEnabled: false,
        get: vi.fn().mockResolvedValue({
          data: {
            allowances: [],
            pagination: { next_key: null, total: 0 }
          }
        })
      } as any);
      setupQuery(() => useAllowancesGranted(""), {
        services: {
          chainApiHttpClient: () => chainApiHttpClient
        },
        wrapper: ({ children }) => <MockSettingsProvider>{children}</MockSettingsProvider>
      });

      expect(chainApiHttpClient.get).not.toHaveBeenCalled();
    });
  });
});
