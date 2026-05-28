import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/hooks/useEnsureTrialStarted";
import { useEnsureTrialStarted } from "@src/hooks/useEnsureTrialStarted";
import type { useManagedWallet } from "@src/hooks/useManagedWallet";

import { renderHook } from "@testing-library/react";

describe("useEnsureTrialStarted", () => {
  it("fires create()", () => {
    const { create } = setup({ wallet: undefined, isLoading: false });

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not fire when the wallet is already initialized", () => {
    const { create } = setup({ wallet: { address: "akash1..." }, isLoading: false });

    expect(create).not.toHaveBeenCalled();
  });

  it("fires when a wallet row exists but is not yet initialized (no address)", () => {
    const { create } = setup({ wallet: { address: null } as never, isLoading: false });

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not fire while another mutation is in flight", () => {
    const { create } = setup({ wallet: undefined, isLoading: true });

    expect(create).not.toHaveBeenCalled();
  });

  it("does not fire after a terminal createError", () => {
    const { create } = setup({ wallet: undefined, isLoading: false, createError: new Error("boom") });

    expect(create).not.toHaveBeenCalled();
  });

  it("does not fire twice across re-renders", () => {
    const { create, rerender } = setup({ wallet: undefined, isLoading: false });
    rerender();
    rerender();

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("exposes isWalletReady, isLoading and error", () => {
    const { result } = setup({ wallet: { address: "akash1..." }, isLoading: true, createError: new Error("boom") });

    expect(result.current.isWalletReady).toBe(true);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeTruthy();
  });

  function setup(input: { wallet: { address: string } | undefined; isLoading: boolean; createError?: unknown }) {
    const create = vi.fn();
    const useManagedWalletSpy = vi.fn<typeof DEPENDENCIES.useManagedWallet>(() =>
      mock<ReturnType<typeof useManagedWallet>>({
        wallet: input.wallet as ReturnType<typeof useManagedWallet>["wallet"],
        isLoading: input.isLoading,
        create,
        createError: input.createError as ReturnType<typeof useManagedWallet>["createError"]
      })
    );

    const { result, rerender } = renderHook(() => useEnsureTrialStarted({ useManagedWallet: useManagedWalletSpy }));

    return { result, rerender, create };
  }
});
