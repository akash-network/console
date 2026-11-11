import type { ApiManagedWalletOutput, ManagedWalletHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { focusManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useManagedWalletQuery } from "./useManagedWalletQuery";

import { act } from "@testing-library/react";
import { buildManagedWallet } from "@tests/seeders/managedWallet";
import { setupQuery } from "@tests/unit/query-client";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe(useManagedWalletQuery.name, () => {
  afterEach(() => {
    vi.useRealTimers();
    focusManager.setFocused(undefined);
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

  it("fetches a wallet with a refused trial again every minute", async () => {
    const { managedWalletService } = await setup({ wallet: buildManagedWallet({ isTrialRefused: true }) });

    await act(() => vi.advanceTimersByTimeAsync(59_000));
    const fetchesBeforeTheMinute = managedWalletService.getWallet.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(2_000));

    expect(fetchesBeforeTheMinute).toBe(1);
    expect(managedWalletService.getWallet).toHaveBeenCalledTimes(2);
  });

  it("stops fetching the wallet again once its trial is no longer refused", async () => {
    const { managedWalletService, result } = await setup({
      wallet: buildManagedWallet({ isTrialRefused: true }),
      walletOnLaterFetches: buildManagedWallet({ isTrialRefused: false })
    });

    await act(() => vi.advanceTimersByTimeAsync(ONE_DAY_MS));

    expect(managedWalletService.getWallet).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ isSuccess: true, isStale: false });
  });

  it("lets a wallet with a refused trial go stale after a minute in a tab that is not focused", async () => {
    const { result, managedWalletService } = await setup({ wallet: buildManagedWallet({ isTrialRefused: true }) });
    focusManager.setFocused(false);

    await act(() => vi.advanceTimersByTimeAsync(59_000));
    const beforeTheMinute = result.current;
    await act(() => vi.advanceTimersByTimeAsync(2_000));

    expect(beforeTheMinute).toEqual({ isSuccess: true, isStale: false });
    expect(result.current).toEqual({ isSuccess: true, isStale: true });
    expect(managedWalletService.getWallet).toHaveBeenCalledTimes(1);
  });

  it("fetches any other wallet once and never lets it go stale", async () => {
    const { result, managedWalletService } = await setup({ wallet: buildManagedWallet({ isTrialRefused: false }) });

    await act(() => vi.advanceTimersByTimeAsync(ONE_DAY_MS));

    expect(result.current).toEqual({ isSuccess: true, isStale: false });
    expect(managedWalletService.getWallet).toHaveBeenCalledTimes(1);
  });

  it("keeps fetching every five seconds while the wallet has no address yet", async () => {
    const { managedWalletService } = await setup({ wallet: null });

    await act(() => vi.advanceTimersByTimeAsync(4_000));
    const fetchesBeforeFiveSeconds = managedWalletService.getWallet.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(2_000));

    expect(fetchesBeforeFiveSeconds).toBe(1);
    expect(managedWalletService.getWallet).toHaveBeenCalledTimes(2);
  });

  async function setup(input: { wallet: ApiManagedWalletOutput | null; walletOnLaterFetches?: ApiManagedWalletOutput }) {
    vi.useFakeTimers();
    const managedWalletService = mock<ManagedWalletHttpService>({
      getWallet: vi
        .fn()
        .mockResolvedValue(input.walletOnLaterFetches ?? input.wallet)
        .mockResolvedValueOnce(input.wallet)
    });
    const rendered = setupQuery(
      () => {
        const { isStale, isSuccess } = useManagedWalletQuery("user-1");
        return { isStale, isSuccess };
      },
      { services: { managedWalletService: () => managedWalletService } }
    );
    await act(() => vi.advanceTimersByTimeAsync(0));

    return { ...rendered, managedWalletService };
  }
});
