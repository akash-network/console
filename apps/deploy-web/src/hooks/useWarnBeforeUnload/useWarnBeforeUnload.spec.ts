import { describe, expect, it } from "vitest";

import { useWarnBeforeUnload } from "./useWarnBeforeUnload";

import { renderHook } from "@testing-library/react";

describe(useWarnBeforeUnload.name, () => {
  it("asks the browser to confirm leaving while active", () => {
    setup({ isActive: true });

    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(true);
  });

  it("lets the page unload unasked while inactive", () => {
    setup({ isActive: false });

    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
  });

  it("stops asking once it turns inactive", () => {
    const { rerender } = setup({ isActive: true });

    rerender({ isActive: false });
    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
  });

  it("stops asking once unmounted", () => {
    const { unmount } = setup({ isActive: true });

    unmount();
    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
  });

  function dispatchBeforeUnload() {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event;
  }

  function setup(input: { isActive: boolean }) {
    return renderHook(({ isActive }) => useWarnBeforeUnload(isActive), { initialProps: input });
  }
});
