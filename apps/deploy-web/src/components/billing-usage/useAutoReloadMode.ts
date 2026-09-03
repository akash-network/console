"use client";
import { type AutoReloadMode, useWalletSettingsQuery } from "@src/queries";

export const DEPENDENCIES = { useWalletSettingsQuery };

export type AutoReloadModeState = {
  mode: AutoReloadMode;
  /** Whether to present the fixed-threshold rule; a stored prediction mode keeps the legacy card. */
  showsThresholdRule: boolean;
  isLoading: boolean;
};

/** The stored mode always wins, so the billing page never advertises a rule the reload job isn't running. */
export function useAutoReloadMode({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): AutoReloadModeState {
  const { data: walletSettings, isLoading } = d.useWalletSettingsQuery();

  const mode = walletSettings?.autoReloadMode ?? "threshold";

  return {
    mode,
    showsThresholdRule: mode === "threshold",
    isLoading
  };
}
