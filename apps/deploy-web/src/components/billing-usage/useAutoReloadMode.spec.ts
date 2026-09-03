import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useAutoReloadMode";
import { useAutoReloadMode } from "./useAutoReloadMode";

import { renderHook } from "@testing-library/react";

type WalletSettingsQueryResult = ReturnType<typeof DEPENDENCIES.useWalletSettingsQuery>;
type WalletSettings = NonNullable<WalletSettingsQueryResult["data"]>;

describe(useAutoReloadMode.name, () => {
  it("uses the stored mode", () => {
    const { result } = setup({ storedMode: "prediction" });

    expect(result.current.mode).toBe("prediction");
  });

  it("defaults to threshold when nothing is stored", () => {
    const { result } = setup({});

    expect(result.current.mode).toBe("threshold");
  });

  it("shows the threshold rule only when the mode is threshold", () => {
    expect(setup({ storedMode: "threshold" }).result.current.showsThresholdRule).toBe(true);
    expect(setup({ storedMode: "prediction" }).result.current.showsThresholdRule).toBe(false);
  });

  function setup(input: { storedMode?: "prediction" | "threshold"; isLoading?: boolean }) {
    const walletSettings = input.storedMode ? Object.assign(mock<WalletSettings>(), { autoReloadMode: input.storedMode }) : null;
    const walletSettingsQuery = Object.assign(mock<WalletSettingsQueryResult>(), {
      data: walletSettings,
      isLoading: input.isLoading ?? false
    });
    const useWalletSettingsQuery: typeof DEPENDENCIES.useWalletSettingsQuery = () => walletSettingsQuery;

    return renderHook(() => useAutoReloadMode({ dependencies: { useWalletSettingsQuery } }));
  }
});
