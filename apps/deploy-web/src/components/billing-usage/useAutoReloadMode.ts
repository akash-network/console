"use client";
import { useFlag } from "@src/hooks/useFlag";
import { type AutoReloadMode, useWalletSettingsQuery } from "@src/queries";

export const DEPENDENCIES = { useFlag, useWalletSettingsQuery };

export type AutoReloadModeState = {
  mode: AutoReloadMode;
  /** Whether threshold mode is offered at all: the picker, the Edit affordance, and the default for a new enablement. */
  isThresholdModeOffered: boolean;
  /** Whether to present the fixed-threshold rule. False while the flag is off, so a rollback shows the legacy card everywhere at once. */
  showsThresholdRule: boolean;
  isLoading: boolean;
};

/**
 * The stored mode always wins, so the billing page never advertises a rule the reload job isn't running. The flag
 * only decides what an account that has never configured auto reload defaults to.
 */
export function useAutoReloadMode({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): AutoReloadModeState {
  const isThresholdModeOffered = d.useFlag("auto_reload_fixed_threshold");
  const { data: walletSettings, isLoading } = d.useWalletSettingsQuery();

  const mode = walletSettings?.autoReloadMode ?? (isThresholdModeOffered ? "threshold" : "prediction");

  return {
    mode,
    isThresholdModeOffered,
    showsThresholdRule: isThresholdModeOffered && mode === "threshold",
    isLoading
  };
}
