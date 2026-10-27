import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useUnlockAppOnFirstCreate";
import { useUnlockAppOnFirstCreate } from "./useUnlockAppOnFirstCreate";

import { renderHook } from "@testing-library/react";

describe(useUnlockAppOnFirstCreate.name, () => {
  it("reads the profile again once a create is accepted for a user still onboarding", () => {
    const { checkSession } = setup({ dseq: "1000", isOnboarded: false });

    expect(checkSession).toHaveBeenCalledTimes(1);
  });

  it("leaves the profile alone while no create was accepted", () => {
    const { checkSession } = setup({ dseq: null, isOnboarded: false });

    expect(checkSession).not.toHaveBeenCalled();
  });

  it("leaves the profile alone for a user already past onboarding", () => {
    const { checkSession } = setup({ dseq: "1000", isOnboarded: true });

    expect(checkSession).not.toHaveBeenCalled();
  });

  it("reads the profile once per accepted create, however often the page renders", () => {
    const { checkSession, rerender } = setup({ dseq: "1000", isOnboarded: false });

    rerender({ dseq: "1000" });
    rerender({ dseq: "2000" });

    expect(checkSession).toHaveBeenCalledTimes(2);
  });

  it("lets a profile read that fails pass without an unhandled rejection", async () => {
    const { checkSession } = setup({ dseq: "1000", isOnboarded: false, checkSessionError: new Error("offline") });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(checkSession).toHaveBeenCalledTimes(1);
  });

  function setup(input: { dseq: string | null; isOnboarded: boolean; checkSessionError?: Error }) {
    const checkSession = vi.fn(() => (input.checkSessionError ? Promise.reject(input.checkSessionError) : Promise.resolve()));
    const dependencies: typeof DEPENDENCIES = {
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ checkSession }),
      useIsOnboarded: () => input.isOnboarded
    };
    const { rerender } = renderHook(({ dseq }) => useUnlockAppOnFirstCreate(dseq, dependencies), { initialProps: { dseq: input.dseq } });

    return { checkSession, rerender };
  }
});
