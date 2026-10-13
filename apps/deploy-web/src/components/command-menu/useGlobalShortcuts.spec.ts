import { describe, expect, it, onTestFinished, vi } from "vitest";

import { useGlobalShortcuts } from "./useGlobalShortcuts";

import { fireEvent, renderHook } from "@testing-library/react";

describe(useGlobalShortcuts.name, () => {
  it("toggles the menu with Command K on a Mac and stops the browser's own shortcut", () => {
    const { onToggleMenu } = setup({ platform: "MacIntel" });

    const isNotCancelled = fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(onToggleMenu).toHaveBeenCalledTimes(1);
    expect(isNotCancelled).toBe(false);
  });

  it("toggles the menu with Ctrl K elsewhere", () => {
    const { onToggleMenu } = setup({ platform: "Win32" });

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(onToggleMenu).toHaveBeenCalledTimes(1);
  });

  it("ignores the other platform's modifier", () => {
    const { onToggleMenu } = setup({ platform: "Win32" });

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(onToggleMenu).not.toHaveBeenCalled();
  });

  it("toggles the menu while the user types in a field", () => {
    const { onToggleMenu } = setup({ platform: "MacIntel" });
    const field = document.body.appendChild(document.createElement("input"));
    onTestFinished(() => field.remove());

    fireEvent.keyDown(field, { key: "k", metaKey: true });

    expect(onToggleMenu).toHaveBeenCalledTimes(1);
  });

  it("leaves the shortcut to an editor that already handled it", () => {
    const { onToggleMenu } = setup({ platform: "MacIntel" });
    const editor = document.body.appendChild(document.createElement("div"));
    editor.addEventListener("keydown", event => event.preventDefault());
    onTestFinished(() => editor.remove());

    fireEvent.keyDown(editor, { key: "k", metaKey: true });

    expect(onToggleMenu).not.toHaveBeenCalled();
  });

  it("calls the handlers from the latest render", () => {
    const { onToggleMenu, rerender } = setup({ platform: "MacIntel" });
    const nextOnToggleMenu = vi.fn();

    rerender({ onToggleMenu: nextOnToggleMenu });
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(nextOnToggleMenu).toHaveBeenCalledTimes(1);
    expect(onToggleMenu).not.toHaveBeenCalled();
  });

  it("stops listening once unmounted", () => {
    const { onToggleMenu, unmount } = setup({ platform: "MacIntel" });

    unmount();
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(onToggleMenu).not.toHaveBeenCalled();
  });

  function setup(input: { platform: string }) {
    const platform = vi.spyOn(navigator, "platform", "get").mockReturnValue(input.platform);
    onTestFinished(() => platform.mockRestore());
    const onToggleMenu = vi.fn();

    const { rerender, unmount } = renderHook(handlers => useGlobalShortcuts(handlers), { initialProps: { onToggleMenu } });

    return { onToggleMenu, rerender, unmount };
  }
});
