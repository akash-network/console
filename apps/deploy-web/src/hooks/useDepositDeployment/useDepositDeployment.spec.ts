import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./useDepositDeployment";
import { useDepositDeployment } from "./useDepositDeployment";

import { act, renderHook } from "@testing-library/react";

describe(useDepositDeployment.name, () => {
  it("broadcasts deposit message and calls onSuccess", async () => {
    const signAndBroadcastTx = vi.fn().mockResolvedValue(true);
    const onSuccess = vi.fn();
    const { result } = setup({ signAndBroadcastTx, onSuccess });

    await act(async () => {
      await result.current.deposit(10_000_000);
    });

    expect(signAndBroadcastTx).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("does not call onSuccess when tx fails", async () => {
    const signAndBroadcastTx = vi.fn().mockResolvedValue(false);
    const onSuccess = vi.fn();
    const { result } = setup({ signAndBroadcastTx, onSuccess });

    await act(async () => {
      await result.current.deposit(10_000_000);
    });

    expect(signAndBroadcastTx).toHaveBeenCalledOnce();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  function setup(input?: { signAndBroadcastTx?: ReturnType<typeof vi.fn>; onSuccess?: ReturnType<typeof vi.fn> }) {
    const signAndBroadcastTx = input?.signAndBroadcastTx ?? vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useDepositDeployment({
        dseq: "123456",
        denom: "uakt",
        onSuccess: input?.onSuccess as (() => void) | undefined,
        dependencies: {
          useWallet: () =>
            ({
              address: "akash1abc",
              signAndBroadcastTx
            }) as unknown as ReturnType<typeof DEPENDENCIES.useWallet>
        }
      })
    );

    return { result, signAndBroadcastTx };
  }
});
