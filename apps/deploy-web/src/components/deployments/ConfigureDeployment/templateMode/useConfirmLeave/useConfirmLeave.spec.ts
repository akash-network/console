import mitt from "next/dist/shared/lib/mitt";
import type { NextRouter } from "next/router";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useConfirmLeave";
import { useConfirmLeave } from "./useConfirmLeave";

import { renderHook } from "@testing-library/react";

const MESSAGE = "Leave without saving? Your changes to this template will be lost.";

describe(useConfirmLeave.name, () => {
  it("asks before leaving with unsaved changes and stays when refused", () => {
    const { confirm, events, routeChangeErrors } = setup({ isDirty: true, confirms: false });

    expect(() => events.emit("routeChangeStart", "/templates/mine", { shallow: false })).toThrow();
    expect(confirm).toHaveBeenCalledWith(MESSAGE);
    expect(routeChangeErrors).toHaveBeenCalledWith(expect.anything(), "/templates/mine", { shallow: false });
  });

  it("leaves when the author confirms", () => {
    const { confirm, events, routeChangeErrors } = setup({ isDirty: true, confirms: true });

    expect(() => events.emit("routeChangeStart", "/templates/mine", { shallow: false })).not.toThrow();
    expect(confirm).toHaveBeenCalledWith(MESSAGE);
    expect(routeChangeErrors).not.toHaveBeenCalled();
  });

  it("lets a saved template leave without asking", () => {
    const { confirm, events, rerender } = setup({ isDirty: true, confirms: false });

    rerender({ isDirty: false });

    expect(() => events.emit("routeChangeStart", "/template/tpl-1", { shallow: false })).not.toThrow();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("lets the page leave once leaving is allowed, before it rerenders as saved", () => {
    const { confirm, events, result } = setup({ isDirty: true, confirms: false });

    result.current();

    expect(() => events.emit("routeChangeStart", "/template/tpl-1", { shallow: false })).not.toThrow();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("never asks about a shallow URL rewrite", () => {
    const { confirm, events } = setup({ isDirty: true, confirms: false });

    expect(() => events.emit("routeChangeStart", "/new-deployment/configure?templateMode=new&draftId=d1", { shallow: true })).not.toThrow();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("stops asking once unmounted", () => {
    const { confirm, events, unmount } = setup({ isDirty: true, confirms: false });

    unmount();

    expect(() => events.emit("routeChangeStart", "/templates/mine", { shallow: false })).not.toThrow();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("warns before the page unloads only while there are unsaved changes", () => {
    const { useWarnBeforeUnload, rerender } = setup({ isDirty: true, confirms: false });

    expect(useWarnBeforeUnload).toHaveBeenLastCalledWith(true);

    rerender({ isDirty: false });

    expect(useWarnBeforeUnload).toHaveBeenLastCalledWith(false);
  });

  function setup(input: { isDirty: boolean; confirms: boolean }) {
    const events = mitt();
    const routeChangeErrors = vi.fn();
    events.on("routeChangeError", routeChangeErrors);
    const router = mock<NextRouter>({ events });
    const confirm = vi.fn(() => input.confirms);
    const originalConfirm = window.confirm;
    window.confirm = confirm;
    onTestFinished(() => {
      window.confirm = originalConfirm;
    });
    const useWarnBeforeUnload = vi.fn<typeof DEPENDENCIES.useWarnBeforeUnload>();
    const dependencies: typeof DEPENDENCIES = { useRouter: () => router, useWarnBeforeUnload };

    const hook = renderHook(({ isDirty }) => useConfirmLeave(isDirty, MESSAGE, dependencies), { initialProps: { isDirty: input.isDirty } });

    return { ...hook, events, confirm, routeChangeErrors, useWarnBeforeUnload };
  }
});
