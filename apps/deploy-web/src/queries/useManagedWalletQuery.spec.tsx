import type { ManagedWalletHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useManagedWalletQuery } from "./useManagedWalletQuery";

import { act } from "@testing-library/react";
import { buildManagedWallet } from "@tests/seeders/managedWallet";
import { setupQuery } from "@tests/unit/query-client";

describe(useManagedWalletQuery.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("lets a wallet with a refused trial go stale a minute after it is fetched", async () => {
    const { result } = await setup({ isTrialRefused: true });

    await act(() => vi.advanceTimersByTimeAsync(59_000));
    const beforeTheMinute = result.current;
    await act(() => vi.advanceTimersByTimeAsync(2_000));

    expect(beforeTheMinute).toEqual({ isSuccess: true, isStale: false });
    expect(result.current).toEqual({ isSuccess: true, isStale: true });
  });

  it("never lets any other wallet go stale", async () => {
    const { result } = await setup({ isTrialRefused: false });

    await act(() => vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000));

    expect(result.current).toEqual({ isSuccess: true, isStale: false });
  });

  async function setup(input: { isTrialRefused: boolean }) {
    vi.useFakeTimers();
    const wallet = buildManagedWallet({ isTrialRefused: input.isTrialRefused });
    const managedWalletService = mock<ManagedWalletHttpService>({
      getWallet: vi.fn().mockResolvedValue(wallet)
    });
    const rendered = setupQuery(
      () => {
        const { isStale, isSuccess } = useManagedWalletQuery(wallet.userId);
        return { isStale, isSuccess };
      },
      { services: { managedWalletService: () => managedWalletService } }
    );
    await act(() => vi.advanceTimersByTimeAsync(0));

    return rendered;
  }
});
