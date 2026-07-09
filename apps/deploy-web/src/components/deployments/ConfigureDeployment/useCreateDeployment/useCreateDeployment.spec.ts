import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES, UseCreateDeploymentOptions } from "./useCreateDeployment";
import { useCreateDeployment } from "./useCreateDeployment";

import { renderHook } from "@testing-library/react";

const VARIABLES = { data: { sdl: "sdl", deposit: 0.5 } } as never;

describe(useCreateDeployment.name, () => {
  it("fires the create immediately when the wallet is ready", () => {
    const { result, mutate } = setup({ isWalletReady: true });

    result.current.mutate(VARIABLES, { onSuccess: vi.fn() });

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("holds the create until the wallet becomes ready, then flushes it with the original arguments", () => {
    const onSuccess = vi.fn();
    const { result, mutate, rerender } = setup({ isWalletReady: false });

    result.current.mutate(VARIABLES, { onSuccess });
    expect(mutate).not.toHaveBeenCalled();

    rerender({ isWalletReady: true });

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(VARIABLES, expect.objectContaining({ onSuccess }));
  });

  it("fails a held create through onError when the trial terminally errors", () => {
    const onError = vi.fn();
    const trialError = new Error("trial boom");
    const { result, mutate, rerender } = setup({ isWalletReady: false });

    result.current.mutate(VARIABLES, { onError });
    rerender({ isWalletReady: false, trialError });

    expect(onError).toHaveBeenCalledWith(trialError, VARIABLES, undefined);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("holds a create issued after a trial error rather than failing it synchronously, and flushes once a retry clears the error and the wallet is ready", () => {
    const onError = vi.fn();
    const onSuccess = vi.fn();
    const trialError = new Error("trial boom");
    const { result, mutate, rerender } = setup({ isWalletReady: false, trialError });

    result.current.mutate(VARIABLES, { onError, onSuccess });
    expect(onError).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();

    rerender({ isWalletReady: false });
    expect(onError).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();

    rerender({ isWalletReady: true });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(VARIABLES, expect.objectContaining({ onError, onSuccess }));
  });

  function setup(initialProps: UseCreateDeploymentOptions) {
    const mutate = vi.fn();
    const mutation = mock<ReturnType<typeof DEPENDENCIES.useCreateDeploymentMutation>>({ mutate: mutate as never });
    const useCreateDeploymentMutation: typeof DEPENDENCIES.useCreateDeploymentMutation = () => mutation;

    const view = renderHook(options => useCreateDeployment(options, { useCreateDeploymentMutation }), { initialProps });
    return { ...view, mutate };
  }
});
