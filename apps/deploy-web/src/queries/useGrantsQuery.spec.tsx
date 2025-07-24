import type { AuthzHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import type { AxiosInstance } from "axios";
import { mock } from "jest-mock-extended";

import { useAllowancesGranted, useAllowancesIssued, useGranteeGrants, useGranterGrants } from "./useGrantsQuery";

import { waitFor } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe("useGrantsQuery", () => {
  describe(useGranterGrants.name, () => {
    it("fetches granter grants when address is provided", async () => {
      const mockData = {
        grants: [
          {
            authorization: {
              "@type": "/akash.deployment.v1beta2.DepositDeploymentAuthorization"
            }
          },
          {
            authorization: {
              "@type": "/akash.deployment.v1beta3.DepositDeploymentAuthorization"
            }
          }
        ],
        pagination: { total: 2 }
      };

      const authzHttpService = mock<AuthzHttpService>({
        axios: {
          defaults: { baseURL: "https://api.akash.network" }
        } as AxiosInstance,
        getPaginatedDepositDeploymentGrants: jest.fn().mockResolvedValue(mockData)
      });
      const { result } = setupQuery(() => useGranterGrants("test-address", 0, 1000), {
        services: {
          authzHttpService: () => authzHttpService
        }
      });

      await waitFor(() => {
        expect(authzHttpService.getPaginatedDepositDeploymentGrants).toHaveBeenCalledWith({ granter: "test-address", limit: 1000, offset: 0 });
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when address is not provided", () => {
      const authzHttpService = mock<AuthzHttpService>({
        axios: {
          defaults: { baseURL: "https://api.akash.network" }
        } as AxiosInstance,
        getPaginatedDepositDeploymentGrants: jest.fn().mockResolvedValue([])
      });
      setupQuery(() => useGranterGrants("", 0, 1000), {
        services: {
          authzHttpService: () => authzHttpService
        }
      });

      expect(authzHttpService.getPaginatedDepositDeploymentGrants).not.toHaveBeenCalled();
    });
  });

  describe(useGranteeGrants.name, () => {
    it("fetches grantee grants when address is provided", async () => {
      const mockData = [
        {
          authorization: {
            "@type": "/akash.deployment.v1beta2.DepositDeploymentAuthorization"
          }
        }
      ];
      const authzHttpService = mock<AuthzHttpService>({
        axios: {
          defaults: { baseURL: "https://api.akash.network" }
        } as AxiosInstance,
        getAllDepositDeploymentGrants: jest.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useGranteeGrants("test-address"), {
        services: {
          authzHttpService: () => authzHttpService
        }
      });

      await waitFor(() => {
        expect(authzHttpService.getAllDepositDeploymentGrants).toHaveBeenCalledWith({ grantee: "test-address", limit: 1000 });
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when address is not provided", () => {
      const authzHttpService = mock<AuthzHttpService>({
        axios: {
          defaults: { baseURL: "https://api.akash.network" }
        } as AxiosInstance,
        getAllDepositDeploymentGrants: jest.fn().mockResolvedValue([])
      });
      setupQuery(() => useGranteeGrants(""), {
        services: {
          authzHttpService: () => authzHttpService
        }
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
        axios: {
          defaults: { baseURL: "https://api.akash.network" }
        } as AxiosInstance,
        getPaginatedFeeAllowancesForGranter: jest.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useAllowancesIssued("test-address", 0, 1000), {
        services: {
          authzHttpService: () => authzHttpService
        }
      });

      await waitFor(() => {
        expect(authzHttpService.getPaginatedFeeAllowancesForGranter).toHaveBeenCalledWith("test-address", 1000, 0);
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when address is not provided", () => {
      const authzHttpService = mock<AuthzHttpService>({
        axios: {
          defaults: { baseURL: "https://api.akash.network" }
        } as AxiosInstance,
        getPaginatedFeeAllowancesForGranter: jest.fn().mockResolvedValue([])
      });
      setupQuery(() => useAllowancesIssued("", 0, 1000), {
        services: {
          authzHttpService: () => authzHttpService
        }
      });

      expect(authzHttpService.getPaginatedFeeAllowancesForGranter).not.toHaveBeenCalled();
    });
  });

  describe(useAllowancesGranted.name, () => {
    it("fetches allowances granted when address is provided", async () => {
      const mockData = [{ id: faker.string.uuid() }];
      const chainApiHttpClient = mock<AxiosInstance>({
        defaults: { baseURL: "https://api.akash.network" },
        get: jest.fn().mockResolvedValue({
          data: {
            allowances: mockData,
            pagination: { next_key: null, total: mockData.length }
          }
        })
      } as any);

      const { result } = setupQuery(() => useAllowancesGranted("test-address"), {
        services: {
          chainApiHttpClient: () => chainApiHttpClient
        }
      });

      await waitFor(() => {
        expect(chainApiHttpClient.get).toHaveBeenCalledWith(
          expect.stringContaining("/cosmos/feegrant/v1beta1/allowances/test-address?pagination.limit=1000&pagination.count_total=true")
        );
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when address is not provided", () => {
      const chainApiHttpClient = mock<AxiosInstance>({
        defaults: { baseURL: "https://api.akash.network" },
        get: jest.fn().mockResolvedValue({
          data: {
            allowances: [],
            pagination: { next_key: null, total: 0 }
          }
        })
      } as any);
      setupQuery(() => useAllowancesGranted(""));

      expect(chainApiHttpClient.get).not.toHaveBeenCalled();
    });
  });
});
