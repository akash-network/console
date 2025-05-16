import { AuthzHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";

import { loadWithPagination } from "@src/utils/apiUtils";
import { useAllowancesGranted, useAllowancesIssued, useGranteeGrants, useGranterGrants } from "./useGrantsQuery";

import { waitFor } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

jest.mock("@akashnetwork/http-sdk", () => {
  const mockService = {
    getAllDepositDeploymentGrants: jest.fn(),
    getPaginatedDepositDeploymentGrants: jest.fn(),
    getPaginatedFeeAllowancesForGranter: jest.fn()
  };

  return {
    ...jest.requireActual("@akashnetwork/http-sdk"),
    AuthzHttpService: jest.fn(() => mockService)
  };
});

jest.mock("@src/context/SettingsProvider", () => ({
  useSettings: () => ({
    settings: {
      apiEndpoint: "test-api-endpoint"
    }
  })
}));

jest.mock("@src/utils/apiUtils", () => ({
  ...jest.requireActual("@src/utils/apiUtils"),
  loadWithPagination: jest.fn()
}));

describe("useGrantsQuery", () => {
  let mockAllowanceHttpService: any;

  beforeEach(() => {
    mockAllowanceHttpService = new AuthzHttpService();
    jest.clearAllMocks();
  });

  describe("useGranterGrants", () => {
    it("should fetch granter grants when address is provided", async () => {
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
      mockAllowanceHttpService.getPaginatedDepositDeploymentGrants.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useGranterGrants("test-address", 0, 1000));

      await waitFor(() => {
        expect(mockAllowanceHttpService.getPaginatedDepositDeploymentGrants).toHaveBeenCalledWith({ granter: "test-address", limit: 1000, offset: 0 });
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should not fetch when address is not provided", () => {
      setupQuery(() => useGranterGrants("", 0, 1000));

      expect(mockAllowanceHttpService.getPaginatedDepositDeploymentGrants).not.toHaveBeenCalled();
    });
  });

  describe("useGranteeGrants", () => {
    it("should fetch grantee grants when address is provided", async () => {
      const mockData = [
        {
          authorization: {
            "@type": "/akash.deployment.v1beta2.DepositDeploymentAuthorization"
          }
        }
      ];
      mockAllowanceHttpService.getAllDepositDeploymentGrants.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useGranteeGrants("test-address"));

      await waitFor(() => {
        expect(mockAllowanceHttpService.getAllDepositDeploymentGrants).toHaveBeenCalledWith({ grantee: "test-address", limit: 1000 });
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should not fetch when address is not provided", () => {
      setupQuery(() => useGranteeGrants(""));

      expect(mockAllowanceHttpService.getAllDepositDeploymentGrants).not.toHaveBeenCalled();
    });
  });

  describe("useAllowancesIssued", () => {
    it("should fetch allowances issued when address is provided", async () => {
      const mockData = {
        allowances: [{ id: faker.string.uuid() }],
        pagination: { total: 1 }
      };
      mockAllowanceHttpService.getPaginatedFeeAllowancesForGranter.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useAllowancesIssued("test-address", 0, 1000));

      await waitFor(() => {
        expect(mockAllowanceHttpService.getPaginatedFeeAllowancesForGranter).toHaveBeenCalledWith("test-address", 1000, 0);
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should not fetch when address is not provided", () => {
      setupQuery(() => useAllowancesIssued("", 0, 1000));

      expect(mockAllowanceHttpService.getPaginatedFeeAllowancesForGranter).not.toHaveBeenCalled();
    });
  });

  describe("useAllowancesGranted", () => {
    it("should fetch allowances granted when address is provided", async () => {
      const mockData = [{ id: faker.string.uuid() }];
      (loadWithPagination as jest.Mock).mockResolvedValue(mockData);

      const { result } = setupQuery(() => useAllowancesGranted("test-address"));

      await waitFor(() => {
        expect(loadWithPagination).toHaveBeenCalledWith(expect.any(String), "allowances", 1000);
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should not fetch when address is not provided", () => {
      setupQuery(() => useAllowancesGranted(""));

      expect(loadWithPagination).not.toHaveBeenCalled();
    });
  });
});
