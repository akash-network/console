import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./useMintACT";
import { useMintACT } from "./useMintACT";

import { act, renderHook } from "@testing-library/react";

describe(useMintACT.name, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns isLoading false, isSuccess false, and no error initially", () => {
    const { result } = setup();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets error when wallet is not connected", async () => {
    const { result } = setup({ address: "" });

    await act(async () => {
      await result.current.mint(50_000_000);
    });

    expect(result.current.isSuccess).toBe(false);
    expect(result.current.error).toBe("Wallet not connected or price unavailable");
  });

  it("sets error when price is unavailable", async () => {
    const { result } = setup({ price: null });

    await act(async () => {
      await result.current.mint(50_000_000);
    });

    expect(result.current.isSuccess).toBe(false);
    expect(result.current.error).toBe("Wallet not connected or price unavailable");
  });

  it("sets error when AKT balance is insufficient", async () => {
    const { result } = setup({ balanceUAKT: 1_000 });

    await act(async () => {
      await result.current.mint(50_000_000);
    });

    expect(result.current.isSuccess).toBe(false);
    expect(result.current.error).toBe("Insufficient AKT balance for minting");
  });

  it("broadcasts mint tx and sets isSuccess on success", async () => {
    const signAndBroadcastTx = vi.fn().mockResolvedValue(true);
    const waitForLedgerRecordsSettlement = vi.fn().mockResolvedValue(true);
    const refetch = vi.fn();
    const { result } = setup({ signAndBroadcastTx, waitForLedgerRecordsSettlement, refetch });

    let mintPromise: Promise<void>;
    await act(async () => {
      mintPromise = result.current.mint(50_000_000);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await act(async () => mintPromise!);

    expect(result.current.isSuccess).toBe(true);
    expect(signAndBroadcastTx).toHaveBeenCalledOnce();
    expect(waitForLedgerRecordsSettlement).toHaveBeenCalled();
    expect(refetch).toHaveBeenCalled();
  });

  it("sets error when tx broadcast fails", async () => {
    const signAndBroadcastTx = vi.fn().mockResolvedValue(false);
    const { result } = setup({ signAndBroadcastTx });

    await act(async () => {
      await result.current.mint(50_000_000);
    });

    expect(result.current.isSuccess).toBe(false);
    expect(result.current.error).toBe("Mint transaction failed");
  });

  it("computes AKT to burn using price with slippage", async () => {
    const signAndBroadcastTx = vi.fn().mockResolvedValue(true);
    const waitForLedgerRecordsSettlement = vi.fn().mockResolvedValue(true);
    const { result } = setup({ signAndBroadcastTx, waitForLedgerRecordsSettlement, price: 2.0 });

    let mintPromise: Promise<void>;
    await act(async () => {
      mintPromise = result.current.mint(100_000_000);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await act(async () => mintPromise!);

    const call = signAndBroadcastTx.mock.calls[0][0][0];
    const amount = Number(call.value.coinsToBurn.amount);
    // 100_000_000 / 2.0 * 1.02 = 51_000_000
    expect(amount).toBe(51_000_000);
  });

  function setup(input?: {
    address?: string;
    price?: number | null;
    balanceUAKT?: number;
    signAndBroadcastTx?: ReturnType<typeof vi.fn>;
    waitForLedgerRecordsSettlement?: ReturnType<typeof vi.fn>;
    refetch?: ReturnType<typeof vi.fn>;
  }) {
    const signAndBroadcastTx = input?.signAndBroadcastTx ?? vi.fn().mockResolvedValue(true);
    const waitForLedgerRecordsSettlement = input?.waitForLedgerRecordsSettlement ?? vi.fn().mockResolvedValue(true);
    const refetch = input?.refetch ?? vi.fn();

    const dependencies = {
      useWallet: () =>
        ({
          address: input?.address ?? "akash1abc",
          signAndBroadcastTx
        }) as unknown as ReturnType<typeof DEPENDENCIES.useWallet>,
      useServices: () =>
        ({
          bmeHttpService: { waitForLedgerRecordsSettlement },
          errorHandler: { reportError: vi.fn() }
        }) as unknown as ReturnType<typeof DEPENDENCIES.useServices>,
      useWalletBalance: () =>
        ({
          balance: { balanceUAKT: input?.balanceUAKT ?? 500_000_000 },
          refetch
        }) as unknown as ReturnType<typeof DEPENDENCIES.useWalletBalance>,
      usePricing: () =>
        ({
          price: input?.price === null ? undefined : input?.price ?? 2.0
        }) as unknown as ReturnType<typeof DEPENDENCIES.usePricing>,
      useBmeParams: () =>
        ({
          data: { minMintAct: 5 }
        }) as unknown as ReturnType<typeof DEPENDENCIES.useBmeParams>
    };

    const { result } = renderHook(() => useMintACT({ dependencies }));

    return { result, signAndBroadcastTx, waitForLedgerRecordsSettlement, refetch };
  }
});
