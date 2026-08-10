import type { ManagedWalletHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useManagedWalletQuery } from "./useManagedWalletQuery";

import { setupQuery } from "@tests/unit/query-client";

describe(useManagedWalletQuery.name, () => {
  it("fetches the wallet when userId is provided", async () => {
    const mockData = {
      userId: faker.string.uuid(),
      address: faker.finance.ethereumAddress()
    };
    const managedWalletService = mock<ManagedWalletHttpService>({
      getWallet: vi.fn().mockResolvedValue(mockData)
    });

    const { result } = setupQuery(() => useManagedWalletQuery(mockData.userId), {
      services: { managedWalletService: () => managedWalletService }
    });

    await vi.waitFor(() => {
      expect(managedWalletService.getWallet).toHaveBeenCalledWith({ userId: mockData.userId });
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockData);
    });
  });

  it("does not fetch when userId is not provided", () => {
    const managedWalletService = mock<ManagedWalletHttpService>({
      getWallet: vi.fn().mockResolvedValue({})
    });
    const { result } = setupQuery(() => useManagedWalletQuery(), {
      services: { managedWalletService: () => managedWalletService }
    });

    expect(managedWalletService.getWallet).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
