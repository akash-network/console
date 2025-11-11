import { faker } from "@faker-js/faker";
import { useQueryClient } from "@tanstack/react-query";
import { mock } from "jest-mock-extended";

import type { ManagedWalletHttpService } from "@src/services/managed-wallet-http/managed-wallet-http.service";
import { useCreateManagedWalletMutation, useManagedWalletQuery } from "./useManagedWalletQuery";

import { act, waitFor } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe(useManagedWalletQuery.name, () => {
  describe(useManagedWalletQuery.name, () => {
    it("should fetch wallet when userId is provided", async () => {
      const mockData = {
        userId: faker.string.uuid(),
        address: faker.finance.ethereumAddress()
      };
      const managedWalletService = mock<ManagedWalletHttpService>({
        getWallet: jest.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useManagedWalletQuery(mockData.userId), {
        services: { managedWalletService: () => managedWalletService }
      });

      await waitFor(() => {
        expect(managedWalletService.getWallet).toHaveBeenCalledWith(mockData.userId);
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should not fetch when userId is not provided", () => {
      const managedWalletService = mock<ManagedWalletHttpService>({
        getWallet: jest.fn().mockResolvedValue({})
      });
      const { result } = setupQuery(() => useManagedWalletQuery(), {
        services: { managedWalletService: () => managedWalletService }
      });

      expect(managedWalletService.getWallet).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe(useCreateManagedWalletMutation.name, () => {
    it("should create wallet and update query cache", async () => {
      const mockData = {
        userId: faker.string.uuid(),
        address: faker.finance.ethereumAddress()
      };
      const mockManagedWalletService = mock<ManagedWalletHttpService>({
        createWallet: jest.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(
        () => {
          const mutation = useCreateManagedWalletMutation();
          const queryClient = useQueryClient();

          return { mutation, queryClient };
        },
        {
          services: { managedWalletService: () => mockManagedWalletService }
        }
      );

      await act(async () => result.current.mutation.mutateAsync({ userId: mockData.userId }));

      await waitFor(() => {
        expect(mockManagedWalletService.createWallet).toHaveBeenCalledWith(mockData.userId, undefined);
        expect(result.current.mutation.isSuccess).toBe(true);
        expect(result.current.queryClient.getQueryData(["MANAGED_WALLET", mockData.userId])).toEqual(mockData);
      });
    });
  });
});
