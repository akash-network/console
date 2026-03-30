import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./XTerm";
import XTerm, { getTheme } from "./XTerm";

import { render } from "@testing-library/react";

describe("getTheme", () => {
  it("returns dark theme colors when resolvedTheme is dark", () => {
    const theme = getTheme("dark");

    expect(theme).toEqual({
      background: "#1e1e1e",
      foreground: "white",
      cursor: "white",
      cursorAccent: "#1e1e1e",
      selectionBackground: "white",
      selectionForeground: "black",
      selectionInactiveBackground: "white"
    });
  });

  it("returns light theme colors when resolvedTheme is light", () => {
    const theme = getTheme("light");

    expect(theme).toEqual({
      background: "white",
      foreground: "black",
      cursor: "black",
      cursorAccent: "white",
      selectionBackground: "black",
      selectionForeground: "white",
      selectionInactiveBackground: "black"
    });
  });

  it("returns light theme colors when resolvedTheme is undefined", () => {
    const theme = getTheme(undefined);

    expect(theme.background).toBe("white");
    expect(theme.foreground).toBe("black");
  });
});

describe("XTerm", () => {
  it("creates terminal and opens it on mount", () => {
    const { mockTerminal, mockFitAddon } = setup();

    expect(mockTerminal.open).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    expect(mockTerminal.loadAddon).toHaveBeenCalledWith(mockFitAddon);
    expect(mockFitAddon.fit).toHaveBeenCalled();
    expect(mockTerminal.attachCustomKeyEventHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  it("loads additional addons when provided", () => {
    const addon = { activate: vi.fn(), dispose: vi.fn() };
    const { mockTerminal } = setup({ addons: [addon] });

    expect(mockTerminal.loadAddon).toHaveBeenCalledWith(addon);
  });

  it("disposes terminal and fit addon on unmount", () => {
    const { unmount, mockTerminal, mockFitAddon } = setup();

    unmount();

    expect(mockFitAddon.dispose).toHaveBeenCalled();
    expect(mockTerminal.dispose).toHaveBeenCalled();
  });

  it("updates theme when resolvedTheme changes", () => {
    let currentTheme = "dark";
    const useThemeMock = () => ({ resolvedTheme: currentTheme });
    const { mockTerminal, rerender, MockTerminal, MockFitAddon, copyTextToClipboardMock } = setup({ useThemeMock });

    expect(mockTerminal.options.theme).toEqual(getTheme("dark"));

    currentTheme = "light";
    rerender(
      <XTerm
        dependencies={{
          Terminal: MockTerminal as unknown as typeof DEPENDENCIES.Terminal,
          FitAddon: MockFitAddon as unknown as typeof DEPENDENCIES.FitAddon,
          useTheme: useThemeMock as unknown as typeof DEPENDENCIES.useTheme,
          copyTextToClipboard: copyTextToClipboardMock
        }}
      />
    );

    expect(mockTerminal.options.theme).toEqual(getTheme("light"));
  });

  it("handles fit failure gracefully", () => {
    const mockFitAddonInstance = createMockFitAddon();
    mockFitAddonInstance.fit.mockImplementation(() => {
      throw new Error("Renderer not attached");
    });

    expect(() => setup({ mockFitAddon: mockFitAddonInstance })).not.toThrow();
  });

  describe("key event handler", () => {
    it("delegates to customKeyEventHandler when provided", () => {
      const customHandler = vi.fn().mockReturnValue(false);
      const { getKeyHandler } = setup({ customKeyEventHandler: customHandler });
      const handler = getKeyHandler();

      const event = new KeyboardEvent("keydown", { code: "KeyA" });
      const result = handler(event);

      expect(customHandler).toHaveBeenCalledWith(event);
      expect(result).toBe(false);
    });

    it("uses latest customKeyEventHandler via ref after rerender", () => {
      const firstHandler = vi.fn().mockReturnValue(true);
      const secondHandler = vi.fn().mockReturnValue(false);
      const { getKeyHandler, rerender, MockTerminal, MockFitAddon, copyTextToClipboardMock, useThemeMock } = setup({
        customKeyEventHandler: firstHandler
      });

      rerender(
        <XTerm
          dependencies={{
            Terminal: MockTerminal as unknown as typeof DEPENDENCIES.Terminal,
            FitAddon: MockFitAddon as unknown as typeof DEPENDENCIES.FitAddon,
            useTheme: useThemeMock as unknown as typeof DEPENDENCIES.useTheme,
            copyTextToClipboard: copyTextToClipboardMock
          }}
          customKeyEventHandler={secondHandler}
        />
      );

      const handler = getKeyHandler();
      const event = new KeyboardEvent("keydown", { code: "KeyA" });
      handler(event);

      expect(secondHandler).toHaveBeenCalledWith(event);
      expect(firstHandler).not.toHaveBeenCalled();
    });

    it("copies selection on Ctrl+C when text is selected", () => {
      const { getKeyHandler, mockTerminal, copyTextToClipboardMock } = setup();
      mockTerminal.getSelection.mockReturnValue("selected text");
      const handler = getKeyHandler();

      const event = new KeyboardEvent("keydown", { code: "KeyC", ctrlKey: true });
      const result = handler(event);

      expect(copyTextToClipboardMock).toHaveBeenCalledWith("selected text");
      expect(result).toBe(false);
    });

    it("returns true for unhandled key events", () => {
      const { getKeyHandler } = setup();
      const handler = getKeyHandler();

      const event = new KeyboardEvent("keydown", { code: "KeyA" });
      const result = handler(event);

      expect(result).toBe(true);
    });
  });

  function createMockTerminal() {
    return {
      attachCustomKeyEventHandler: vi.fn(),
      loadAddon: vi.fn(),
      open: vi.fn(),
      dispose: vi.fn(),
      write: vi.fn(),
      clear: vi.fn(),
      reset: vi.fn(),
      focus: vi.fn(),
      getSelection: vi.fn().mockReturnValue(""),
      onBinary: vi.fn(() => ({ dispose: vi.fn() })),
      onCursorMove: vi.fn(() => ({ dispose: vi.fn() })),
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      onKey: vi.fn(() => ({ dispose: vi.fn() })),
      onLineFeed: vi.fn(() => ({ dispose: vi.fn() })),
      onScroll: vi.fn(() => ({ dispose: vi.fn() })),
      onSelectionChange: vi.fn(() => ({ dispose: vi.fn() })),
      onRender: vi.fn(() => ({ dispose: vi.fn() })),
      onResize: vi.fn(() => ({ dispose: vi.fn() })),
      onTitleChange: vi.fn(() => ({ dispose: vi.fn() })),
      options: {} as Record<string, unknown>
    };
  }

  function createMockFitAddon() {
    return {
      fit: vi.fn(),
      dispose: vi.fn(),
      activate: vi.fn()
    };
  }

  function setup(input?: {
    resolvedTheme?: string;
    addons?: Array<{ activate: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }>;
    customKeyEventHandler?: (event: KeyboardEvent) => boolean;
    mockFitAddon?: ReturnType<typeof createMockFitAddon>;
    useThemeMock?: () => { resolvedTheme: string };
  }) {
    const mockTerminal = createMockTerminal();
    const mockFitAddon = input?.mockFitAddon ?? createMockFitAddon();
    const copyTextToClipboardMock = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const MockTerminal = vi.fn(function (this: any) {
      Object.assign(this, mockTerminal);
      return mockTerminal;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const MockFitAddon = vi.fn(function (this: any) {
      Object.assign(this, mockFitAddon);
      return mockFitAddon;
    });
    const useThemeMock = input?.useThemeMock ?? (() => ({ resolvedTheme: input?.resolvedTheme ?? "dark" }));

    const result = render(
      <XTerm
        dependencies={{
          Terminal: MockTerminal as unknown as typeof DEPENDENCIES.Terminal,
          FitAddon: MockFitAddon as unknown as typeof DEPENDENCIES.FitAddon,
          useTheme: useThemeMock as unknown as typeof DEPENDENCIES.useTheme,
          copyTextToClipboard: copyTextToClipboardMock
        }}
        addons={input?.addons as never}
        customKeyEventHandler={input?.customKeyEventHandler}
      />
    );

    const getKeyHandler = () => {
      return mockTerminal.attachCustomKeyEventHandler.mock.calls[0][0] as (event: KeyboardEvent) => boolean;
    };

    return { ...result, mockTerminal, mockFitAddon, MockTerminal, MockFitAddon, copyTextToClipboardMock, useThemeMock, getKeyHandler };
  }
});
