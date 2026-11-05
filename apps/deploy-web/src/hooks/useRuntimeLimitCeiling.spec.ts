import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/hooks/useRuntimeLimitCeiling";
import { useRuntimeLimitCeiling } from "@src/hooks/useRuntimeLimitCeiling";
import { MAX_RUNTIME_LIMIT_HOURS, MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "@src/utils/runtimeLimitUtils";

import { renderHook } from "@testing-library/react";

describe(useRuntimeLimitCeiling.name, () => {
  it("allows a full increment up front and the overall cap in total for a paying user", () => {
    const { result } = setup({ isTrialing: false, trialDeploymentHours: 24 });

    expect(result.current).toEqual({ maxInitialHours: MAX_RUNTIME_LIMIT_INCREMENT_HOURS, maxTotalHours: MAX_RUNTIME_LIMIT_HOURS });
  });

  it("caps a trial user's limit at the trial deployment duration", () => {
    const { result } = setup({ isTrialing: true, trialDeploymentHours: 24 });

    expect(result.current).toEqual({ maxInitialHours: 24, maxTotalHours: 24 });
  });

  it("keeps a trial user's first request within one increment when the trial duration is longer", () => {
    const { result } = setup({ isTrialing: true, trialDeploymentHours: 72 });

    expect(result.current).toEqual({ maxInitialHours: MAX_RUNTIME_LIMIT_INCREMENT_HOURS, maxTotalHours: 72 });
  });

  function setup(input: { isTrialing: boolean; trialDeploymentHours: number }) {
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing });
    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        publicConfig: mock<ReturnType<typeof DEPENDENCIES.useServices>["publicConfig"]>({
          NEXT_PUBLIC_TRIAL_DEPLOYMENTS_DURATION_HOURS: input.trialDeploymentHours
        })
      });

    return renderHook(() => useRuntimeLimitCeiling({ useWallet, useServices }));
  }
});
