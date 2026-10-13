import { describe, expect, it, onTestFinished, vi } from "vitest";

import { COMMAND_PAGES, DEPLOYMENT_START_COMMANDS } from "./commandMenuCatalog";
import type { GlobalShortcutHandlers } from "./useGlobalShortcuts";
import { useGlobalShortcuts } from "./useGlobalShortcuts";

import { fireEvent, renderHook } from "@testing-library/react";

describe(useGlobalShortcuts.name, () => {
  describe("menu toggle", () => {
    it("toggles the menu with Command K on a Mac and stops the browser's own shortcut", () => {
      const { handlers } = setup({ platform: "MacIntel" });

      const isNotCancelled = fireEvent.keyDown(window, { key: "k", metaKey: true });

      expect(handlers.onToggleMenu).toHaveBeenCalledTimes(1);
      expect(isNotCancelled).toBe(false);
    });

    it("toggles the menu with Ctrl K elsewhere", () => {
      const { handlers } = setup({ platform: "Win32" });

      fireEvent.keyDown(window, { key: "k", ctrlKey: true });

      expect(handlers.onToggleMenu).toHaveBeenCalledTimes(1);
    });

    it("toggles once while the keys are held down", () => {
      const { handlers } = setup({ platform: "MacIntel" });

      fireEvent.keyDown(window, { key: "k", metaKey: true });
      const isNotCancelled = fireEvent.keyDown(window, { key: "k", metaKey: true, repeat: true });

      expect(handlers.onToggleMenu).toHaveBeenCalledTimes(1);
      expect(isNotCancelled).toBe(false);
    });

    it("ignores the other platform's modifier", () => {
      const { handlers } = setup({ platform: "Win32" });

      fireEvent.keyDown(window, { key: "k", metaKey: true });

      expect(handlers.onToggleMenu).not.toHaveBeenCalled();
    });

    it("toggles the menu while the user types in a field or a dialog is open", () => {
      const { handlers } = setup({ platform: "MacIntel" });
      const field = appendToBody("input");
      appendToBody("div", { role: "dialog" });

      fireEvent.keyDown(field, { key: "k", metaKey: true });

      expect(handlers.onToggleMenu).toHaveBeenCalledTimes(1);
    });
  });

  describe("single keys", () => {
    it.each([
      { name: "N", event: { key: "n" }, command: DEPLOYMENT_START_COMMANDS[0] },
      { name: "N with caps lock on", event: { key: "N" }, command: DEPLOYMENT_START_COMMANDS[0] },
      { name: "Shift C", event: { key: "C", shiftKey: true }, command: DEPLOYMENT_START_COMMANDS[1] },
      { name: "Shift L", event: { key: "L", shiftKey: true }, command: DEPLOYMENT_START_COMMANDS[2] }
    ])("starts $command.kind with $name and stops the browser's handling", ({ event, command }) => {
      const { handlers } = setup({});

      const isNotCancelled = fireEvent.keyDown(window, event);

      expect(handlers.onStartDeployment).toHaveBeenCalledExactlyOnceWith(command);
      expect(isNotCancelled).toBe(false);
    });

    it("opens the shortcuts sheet with ? and stops the browser's handling", () => {
      const { handlers } = setup({});

      const isNotCancelled = fireEvent.keyDown(window, { key: "?", shiftKey: true });

      expect(handlers.onShowShortcuts).toHaveBeenCalledTimes(1);
      expect(isNotCancelled).toBe(false);
    });

    it("does nothing for keys without a shortcut", () => {
      const { handlers } = setup({});

      const isNotCancelled = fireEvent.keyDown(window, { key: "x" });
      fireEvent.keyDown(window, { key: "c" });

      expect(isNotCancelled).toBe(true);
      expectNothingRan(handlers);
    });
  });

  describe("go-to sequences", () => {
    it("goes to a page with G then its letter and stops the browser's handling", () => {
      const { handlers, pressAt } = setup({});

      const isGoNotCancelled = pressAt(50_000, { key: "g" });
      const isNotCancelled = pressAt(51_000, { key: "t" });

      expect(handlers.onGoTo).toHaveBeenCalledExactlyOnceWith(COMMAND_PAGES[1]);
      expect(isGoNotCancelled).toBe(false);
      expect(isNotCancelled).toBe(false);
    });

    it("keeps the sequence going while G is held down", () => {
      const { handlers, pressAt } = setup({});

      pressAt(50_000, { key: "g" });
      pressAt(50_500, { key: "g", repeat: true });
      pressAt(51_000, { key: "t" });

      expect(handlers.onGoTo).toHaveBeenCalledExactlyOnceWith(COMMAND_PAGES[1]);
    });

    it("lets the letter come up to 1.2 seconds after G", () => {
      const { handlers, pressAt } = setup({});

      pressAt(50_000, { key: "g" });
      pressAt(51_200, { key: "b" });

      expect(handlers.onGoTo).toHaveBeenCalledExactlyOnceWith(COMMAND_PAGES[3]);
    });

    it("forgets G after 1.2 seconds", () => {
      const { handlers, pressAt } = setup({});

      pressAt(50_000, { key: "g" });
      pressAt(51_201, { key: "t" });

      expect(handlers.onGoTo).not.toHaveBeenCalled();
    });

    it("ends the sequence on the next key, mapped or not, leaving an unmapped one to the browser", () => {
      const { handlers, pressAt } = setup({});

      pressAt(50_000, { key: "g" });
      const isNotCancelled = pressAt(50_100, { key: "?", shiftKey: true });
      pressAt(50_200, { key: "t" });

      expectNothingRan(handlers);
      expect(isNotCancelled).toBe(true);
    });

    it("does not go anywhere for a letter typed without G", () => {
      const { handlers } = setup({});

      fireEvent.keyDown(window, { key: "t" });

      expect(handlers.onGoTo).not.toHaveBeenCalled();
    });

    it("forgets G when the next key lands in a field", () => {
      const { handlers, pressAt } = setup({});
      const field = appendToBody("input");

      pressAt(50_000, { key: "g" });
      pressAt(50_100, { key: "t" }, field);
      pressAt(50_200, { key: "t" });

      expect(handlers.onGoTo).not.toHaveBeenCalled();
    });
  });

  describe("when single keys are ignored", () => {
    it.each([
      { name: "an input", element: () => appendToBody("input") },
      { name: "a textarea", element: () => appendToBody("textarea") },
      { name: "a select", element: () => appendToBody("select") },
      { name: "an editable area", element: () => appendToBody("div", { contenteditable: "true" }) },
      { name: "a combobox", element: () => appendToBody("button", { role: "combobox" }) },
      { name: "an open menu", element: () => appendToBody("div", { role: "menu" }) },
      { name: "a listbox", element: () => appendToBody("div", { role: "listbox" }) }
    ])("ignores keys typed in $name", ({ element }) => {
      const { handlers } = setup({});

      fireEvent.keyDown(element(), { key: "n" });

      expectNothingRan(handlers);
    });

    it("ignores keys inside an element nested in an editable area", () => {
      const { handlers } = setup({});
      const editor = appendToBody("div", { contenteditable: "true" });
      const line = editor.appendChild(document.createElement("span"));

      fireEvent.keyDown(line, { key: "n" });

      expectNothingRan(handlers);
    });

    it("listens again in an area that is no longer editable", () => {
      const { handlers } = setup({});

      fireEvent.keyDown(appendToBody("div", { contenteditable: "false" }), { key: "n" });

      expect(handlers.onStartDeployment).toHaveBeenCalledTimes(1);
    });

    it.each([{ role: "dialog" }, { role: "alertdialog" }])("ignores keys while a $role is open", ({ role }) => {
      const { handlers } = setup({});
      appendToBody("div", { role });

      fireEvent.keyDown(window, { key: "?", shiftKey: true });

      expectNothingRan(handlers);
    });

    it.each([{ metaKey: true }, { ctrlKey: true }, { altKey: true }])("ignores keys pressed with a modifier (%o)", modifier => {
      const { handlers } = setup({});

      fireEvent.keyDown(window, { key: "n", ...modifier });

      expectNothingRan(handlers);
    });

    it("ignores a held-down key repeating", () => {
      const { handlers } = setup({});

      fireEvent.keyDown(window, { key: "n", repeat: true });

      expectNothingRan(handlers);
    });

    it("ignores keys while an input method is composing", () => {
      const { handlers } = setup({});

      fireEvent.keyDown(window, { key: "n", isComposing: true });

      expectNothingRan(handlers);
    });

    it("leaves keys to an editor that already handled them", () => {
      const { handlers } = setup({});
      const editor = appendToBody("div");
      editor.addEventListener("keydown", event => event.preventDefault());

      fireEvent.keyDown(editor, { key: "n" });
      fireEvent.keyDown(editor, { key: "k", metaKey: true });

      expectNothingRan(handlers);
      expect(handlers.onToggleMenu).not.toHaveBeenCalled();
    });
  });

  it("calls the handlers from the latest render", () => {
    const { handlers, rerender } = setup({ platform: "MacIntel" });
    const nextHandlers = createHandlers();

    rerender(nextHandlers);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.keyDown(window, { key: "n" });

    expect(nextHandlers.onToggleMenu).toHaveBeenCalledTimes(1);
    expect(nextHandlers.onStartDeployment).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleMenu).not.toHaveBeenCalled();
  });

  it("stops listening once unmounted", () => {
    const { handlers, unmount } = setup({ platform: "MacIntel" });

    unmount();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.keyDown(window, { key: "n" });

    expect(handlers.onToggleMenu).not.toHaveBeenCalled();
    expectNothingRan(handlers);
  });

  function expectNothingRan(handlers: GlobalShortcutHandlers) {
    expect(handlers.onStartDeployment).not.toHaveBeenCalled();
    expect(handlers.onShowShortcuts).not.toHaveBeenCalled();
    expect(handlers.onGoTo).not.toHaveBeenCalled();
  }

  function appendToBody(tagName: string, attributes: Record<string, string> = {}) {
    const element = document.body.appendChild(document.createElement(tagName));
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    onTestFinished(() => element.remove());
    return element;
  }

  function createHandlers() {
    return { onToggleMenu: vi.fn(), onShowShortcuts: vi.fn(), onStartDeployment: vi.fn(), onGoTo: vi.fn() };
  }

  function setup(input: { platform?: string }) {
    const platform = vi.spyOn(navigator, "platform", "get").mockReturnValue(input.platform ?? "MacIntel");
    const now = vi.spyOn(Date, "now");
    onTestFinished(() => {
      platform.mockRestore();
      now.mockRestore();
    });
    const handlers = createHandlers();

    const { rerender, unmount } = renderHook(nextHandlers => useGlobalShortcuts(nextHandlers), { initialProps: handlers });

    const pressAt = (time: number, event: KeyboardEventInit, target: Element | Window = window) => {
      now.mockReturnValue(time);
      return fireEvent.keyDown(target, event);
    };

    return { handlers, rerender, unmount, pressAt };
  }
});
