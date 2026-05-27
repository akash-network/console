import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useEnsureTrialStarted } from "@src/hooks/useEnsureTrialStarted";
import { useManagedWallet } from "@src/hooks/useManagedWallet";

import { renderHook } from "@testing-library/react";

vi.mock("@src/hooks/useManagedWallet");

describe("useEnsureTrialStarted", () => {
  it("fires create()", () => {
    const create = vi.fn();
    setup({ wallet: undefined, isLoading: false, create });

    renderHook(() => useEnsureTrialStarted());

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not fire when the wallet is already initialized", () => {
    const create = vi.fn();
    setup({ wallet: { address: "akash1..." }, isLoading: false, create });

    renderHook(() => useEnsureTrialStarted());

    expect(create).not.toHaveBeenCalled();
  });

  it("fires when a wallet row exists but is not yet initialized (no address)", () => {
    const create = vi.fn();
    setup({ wallet: { address: null } as never, isLoading: false, create });

    renderHook(() => useEnsureTrialStarted());

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not fire while another mutation is in flight", () => {
    const create = vi.fn();
    setup({ wallet: undefined, isLoading: true, create });

    renderHook(() => useEnsureTrialStarted());

    expect(create).not.toHaveBeenCalled();
  });

  it("does not fire after a terminal createError", () => {
    const create = vi.fn();
    setup({ wallet: undefined, isLoading: false, create, createError: new Error("boom") });

    renderHook(() => useEnsureTrialStarted());

    expect(create).not.toHaveBeenCalled();
  });

  it("does not fire twice across re-renders", () => {
    const create = vi.fn();
    setup({ wallet: undefined, isLoading: false, create });

    const { rerender } = renderHook(() => useEnsureTrialStarted());
    rerender();
    rerender();

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("exposes isWalletReady, isLoading and error", () => {
    setup({ wallet: { address: "akash1..." }, isLoading: true, create: vi.fn(), createError: new Error("boom") });

    const { result } = renderHook(() => useEnsureTrialStarted());

    expect(result.current.isWalletReady).toBe(true);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeTruthy();
  });

  function setup(input: { wallet: { address: string } | undefined; isLoading: boolean; create: () => void; createError?: unknown }) {
    vi.mocked(useManagedWallet).mockReturnValue(
      mock<ReturnType<typeof useManagedWallet>>({
        wallet: input.wallet as ReturnType<typeof useManagedWallet>["wallet"],
        isLoading: input.isLoading,
        create: input.create,
        createError: input.createError as ReturnType<typeof useManagedWallet>["createError"]
      })
    );
  }
});
