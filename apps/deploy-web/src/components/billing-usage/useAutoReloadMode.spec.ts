import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useAutoReloadMode";
import { useAutoReloadMode } from "./useAutoReloadMode";

import { renderHook } from "@testing-library/react";

type WalletSettingsQueryResult = ReturnType<typeof DEPENDENCIES.useWalletSettingsQuery>;
type WalletSettings = NonNullable<WalletSettingsQueryResult["data"]>;

describe(useAutoReloadMode.name, () => {
  it("uses the stored mode even when threshold mode is not offered", () => {
    const { result } = setup({ isThresholdModeOffered: false, storedMode: "threshold" });

    expect(result.current.mode).toBe("threshold");
  });

  it("uses the stored mode when threshold mode is offered", () => {
    const { result } = setup({ isThresholdModeOffered: true, storedMode: "prediction" });

    expect(result.current.mode).toBe("prediction");
  });

  it("defaults to threshold when nothing is stored and threshold mode is offered", () => {
    const { result } = setup({ isThresholdModeOffered: true });

    expect(result.current.mode).toBe("threshold");
  });

  it("defaults to prediction when nothing is stored and threshold mode is not offered", () => {
    const { result } = setup({ isThresholdModeOffered: false });

    expect(result.current.mode).toBe("prediction");
  });

  it("reports whether threshold mode is offered", () => {
    const { result } = setup({ isThresholdModeOffered: true });

    expect(result.current.isThresholdModeOffered).toBe(true);
  });

  it("shows the threshold rule only when it is offered and selected", () => {
    expect(setup({ isThresholdModeOffered: true, storedMode: "threshold" }).result.current.showsThresholdRule).toBe(true);
    expect(setup({ isThresholdModeOffered: true, storedMode: "prediction" }).result.current.showsThresholdRule).toBe(false);
    expect(setup({ isThresholdModeOffered: false, storedMode: "threshold" }).result.current.showsThresholdRule).toBe(false);
  });

  function setup(input: { isThresholdModeOffered?: boolean; storedMode?: "prediction" | "threshold"; isLoading?: boolean }) {
    const useFlag: typeof DEPENDENCIES.useFlag = () => input.isThresholdModeOffered ?? false;

    const walletSettings = input.storedMode ? Object.assign(mock<WalletSettings>(), { autoReloadMode: input.storedMode }) : null;
    const walletSettingsQuery = Object.assign(mock<WalletSettingsQueryResult>(), {
      data: walletSettings,
      isLoading: input.isLoading ?? false
    });
    const useWalletSettingsQuery: typeof DEPENDENCIES.useWalletSettingsQuery = () => walletSettingsQuery;

    return renderHook(() => useAutoReloadMode({ dependencies: { useFlag, useWalletSettingsQuery } }));
  }
});
