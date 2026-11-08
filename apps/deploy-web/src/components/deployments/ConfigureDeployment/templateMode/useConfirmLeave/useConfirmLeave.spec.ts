import type { usePopup } from "@akashnetwork/ui/context";
import type { NavigationGuard, useNavigationGuard as useNavigationGuardLibrary } from "next-navigation-guard";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useNavigationGuard } from "@src/hooks/useNavigationGuard/useNavigationGuard";
import type { DEPENDENCIES } from "./useConfirmLeave";
import { useConfirmLeave } from "./useConfirmLeave";

import { renderHook } from "@testing-library/react";

type NavigationGuardOptions = Parameters<typeof useNavigationGuardLibrary>[0];
type NavigationGuardParams = Parameters<NavigationGuard>[0];

const MESSAGE = "Leave without saving? Your changes to this template will be lost.";

describe(useConfirmLeave.name, () => {
  it("asks before leaving with unsaved changes and stays when refused", async () => {
    const { attemptNavigation, confirm } = setup({ isDirty: true, confirms: false });

    const isAllowed = await attemptNavigation({ to: "/templates/mine", type: "push" });

    expect(confirm).toHaveBeenCalledWith(MESSAGE);
    expect(isAllowed).toBe(false);
  });

  it("leaves when the author confirms", async () => {
    const { attemptNavigation } = setup({ isDirty: true, confirms: true });

    expect(await attemptNavigation({ to: "/templates/mine", type: "push" })).toBe(true);
  });

  it("asks before going back", async () => {
    const { attemptNavigation, confirm } = setup({ isDirty: true, confirms: false });

    expect(await attemptNavigation({ to: "/deployments/12", type: "popstate" })).toBe(false);
    expect(confirm).toHaveBeenCalledWith(MESSAGE);
  });

  it("lets a saved template leave without asking", async () => {
    const { attemptNavigation, confirm, rerender } = setup({ isDirty: true, confirms: false });

    rerender({ isDirty: false });

    expect(await attemptNavigation({ to: "/template/tpl-1", type: "push" })).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("lets the page leave once leaving is allowed, before it rerenders as saved", async () => {
    const { attemptNavigation, confirm, result } = setup({ isDirty: true, confirms: false });

    result.current.allowLeaving();

    expect(await attemptNavigation({ to: "/template/tpl-1", type: "push" })).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("asks again once the allowed navigation did not happen", async () => {
    const { attemptNavigation, confirm, result } = setup({ isDirty: true, confirms: false });

    result.current.allowLeaving();
    result.current.askBeforeLeaving();

    expect(await attemptNavigation({ to: "/template/tpl-1", type: "push" })).toBe(false);
    expect(confirm).toHaveBeenCalledWith(MESSAGE);
  });

  it("never asks about this page rewriting its own URL", async () => {
    const { attemptNavigation, confirm } = setup({ isDirty: true, confirms: false });

    expect(await attemptNavigation({ to: `${window.location.pathname}?templateMode=new&draftId=d1`, type: "replace" })).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("asks about a push onto this page, which starts another session", async () => {
    const { attemptNavigation, confirm } = setup({ isDirty: true, confirms: false });

    expect(await attemptNavigation({ to: `${window.location.pathname}?templateMode=new`, type: "push" })).toBe(false);
    expect(confirm).toHaveBeenCalled();
  });

  it("asks about replacing this page with another", async () => {
    const { attemptNavigation, confirm } = setup({ isDirty: true, confirms: false });

    expect(await attemptNavigation({ to: "/templates/mine", type: "replace" })).toBe(false);
    expect(confirm).toHaveBeenCalled();
  });

  it("warns before the page unloads only while there are unsaved changes", () => {
    const { useWarnBeforeUnload, rerender } = setup({ isDirty: true, confirms: false });

    expect(useWarnBeforeUnload).toHaveBeenLastCalledWith(true);

    rerender({ isDirty: false });

    expect(useWarnBeforeUnload).toHaveBeenLastCalledWith(false);
  });

  function setup(input: { isDirty: boolean; confirms: boolean }) {
    let guard: NavigationGuardOptions = {};
    const confirm = vi.fn(async () => input.confirms);
    const popup = mock<ReturnType<typeof usePopup>>({ confirm });
    const guardLibrary: typeof useNavigationGuardLibrary = options => {
      guard = options;
      return { active: false, accept: vi.fn(), reject: vi.fn() };
    };
    const useWarnBeforeUnload = vi.fn<typeof DEPENDENCIES.useWarnBeforeUnload>();
    const dependencies: typeof DEPENDENCIES = {
      useNavigationGuard: options => useNavigationGuard({ ...options, dependencies: { useNavigationGuard: guardLibrary, usePopup: () => popup } }),
      useWarnBeforeUnload
    };

    const hook = renderHook(({ isDirty }) => useConfirmLeave(isDirty, MESSAGE, dependencies), { initialProps: { isDirty: input.isDirty } });

    async function attemptNavigation(params: NavigationGuardParams) {
      const isEnabled = typeof guard.enabled === "function" ? guard.enabled(params) : guard.enabled !== false;
      return isEnabled ? await guard.confirm?.(params) : true;
    }

    return { ...hook, attemptNavigation, confirm, useWarnBeforeUnload };
  }
});
