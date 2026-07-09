import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/hooks/useEnsureTrialStarted";
import { useEnsureTrialStarted } from "@src/hooks/useEnsureTrialStarted";

import { renderHook } from "@testing-library/react";

describe(useEnsureTrialStarted.name, () => {
  it("fires create()", () => {
    const create = vi.fn();
    const { dependencies } = setup({ wallet: undefined, isLoading: false, create });

    renderHook(() => useEnsureTrialStarted(dependencies));

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not fire when the wallet is already initialized", () => {
    const create = vi.fn();
    const { dependencies } = setup({ wallet: { address: "akash1..." }, isLoading: false, create });

    renderHook(() => useEnsureTrialStarted(dependencies));

    expect(create).not.toHaveBeenCalled();
  });

  it("fires when a wallet row exists but is not yet initialized (no address)", () => {
    const create = vi.fn();
    const { dependencies } = setup({ wallet: { address: null } as never, isLoading: false, create });

    renderHook(() => useEnsureTrialStarted(dependencies));

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not fire while another mutation is in flight", () => {
    const create = vi.fn();
    const { dependencies } = setup({ wallet: undefined, isLoading: true, create });

    renderHook(() => useEnsureTrialStarted(dependencies));

    expect(create).not.toHaveBeenCalled();
  });

  it("does not fire after a terminal createError", () => {
    const create = vi.fn();
    const { dependencies } = setup({ wallet: undefined, isLoading: false, create, createError: new Error("boom") });

    renderHook(() => useEnsureTrialStarted(dependencies));

    expect(create).not.toHaveBeenCalled();
  });

  it("does not fire while a trial start is already in flight from a previous page", () => {
    const create = vi.fn();
    const { dependencies } = setup({ wallet: undefined, isLoading: false, create, isStartingTrial: true });

    renderHook(() => useEnsureTrialStarted(dependencies));

    expect(create).not.toHaveBeenCalled();
  });

  it("does not fire twice across re-renders", () => {
    const create = vi.fn();
    const { dependencies } = setup({ wallet: undefined, isLoading: false, create });

    const { rerender } = renderHook(() => useEnsureTrialStarted(dependencies));
    rerender();
    rerender();

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retryTrial resets the create mutation so a terminally-failed trial can be re-attempted", () => {
    const resetCreate = vi.fn();
    const { dependencies } = setup({ wallet: undefined, isLoading: false, create: vi.fn(), createError: new Error("boom"), resetCreate });

    const { result } = renderHook(() => useEnsureTrialStarted(dependencies));
    result.current.retryTrial();

    expect(resetCreate).toHaveBeenCalledTimes(1);
  });

  it("exposes isWalletReady, isLoading and error", () => {
    const { dependencies } = setup({ wallet: { address: "akash1..." }, isLoading: true, create: vi.fn(), createError: new Error("boom") });

    const { result } = renderHook(() => useEnsureTrialStarted(dependencies));

    expect(result.current.isWalletReady).toBe(true);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeTruthy();
  });

  function setup(input: {
    wallet: { address: string } | undefined;
    isLoading: boolean;
    create: () => void;
    createError?: unknown;
    resetCreate?: () => void;
    isStartingTrial?: boolean;
  }) {
    const useManagedWallet: typeof DEPENDENCIES.useManagedWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useManagedWallet>>({
        wallet: input.wallet as ReturnType<typeof DEPENDENCIES.useManagedWallet>["wallet"],
        isLoading: input.isLoading,
        create: input.create,
        createError: input.createError as ReturnType<typeof DEPENDENCIES.useManagedWallet>["createError"],
        resetCreate: input.resetCreate ?? vi.fn()
      });
    const useIsMutating: typeof DEPENDENCIES.useIsMutating = () => (input.isStartingTrial ? 1 : 0);

    return { dependencies: { useManagedWallet, useIsMutating } };
  }
});
