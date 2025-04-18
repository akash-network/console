import { faker } from "@faker-js/faker";

import { queryClient } from "./queryClient";
import { useCreateManagedWalletMutation, useManagedWalletQuery } from "./useManagedWalletQuery";

import { act, waitFor } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

jest.mock("@src/services/managed-wallet-http/managed-wallet-http.service", () => ({
  managedWalletHttpService: {
    getWallet: jest.fn(),
    createWallet: jest.fn()
  }
}));

describe("useManagedWalletQuery", () => {
  const mockManagedWalletService = jest.requireMock("@src/services/managed-wallet-http/managed-wallet-http.service").managedWalletHttpService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useManagedWalletQuery", () => {
    it("should fetch wallet when userId is provided", async () => {
      const mockData = {
        userId: faker.string.uuid(),
        address: faker.finance.ethereumAddress()
      };
      mockManagedWalletService.getWallet.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useManagedWalletQuery(mockData.userId));

      await waitFor(() => {
        expect(mockManagedWalletService.getWallet).toHaveBeenCalledWith(mockData.userId);
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should not fetch when userId is not provided", () => {
      const { result } = setupQuery(() => useManagedWalletQuery());

      expect(mockManagedWalletService.getWallet).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useCreateManagedWalletMutation", () => {
    it("should create wallet and update query cache", async () => {
      const mockData = {
        userId: faker.string.uuid(),
        address: faker.finance.ethereumAddress()
      };
      mockManagedWalletService.createWallet.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useCreateManagedWalletMutation());

      await act(async () => {
        await result.current.mutateAsync(mockData.userId);
      });

      await waitFor(() => {
        expect(mockManagedWalletService.createWallet).toHaveBeenCalledWith(mockData.userId);
        expect(result.current.isSuccess).toBe(true);
        expect(queryClient.getQueryData(["MANAGED_WALLET", mockData.userId])).toEqual(mockData);
      });
    });
  });
});
