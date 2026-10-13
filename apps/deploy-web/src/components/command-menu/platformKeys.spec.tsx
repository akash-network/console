import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { detectMac, isMenuToggleKey, isShortcutKey, useIsMac } from "./platformKeys";

import { renderHook } from "@testing-library/react";

describe(detectMac.name, () => {
  it.each(["MacIntel", "iPhone", "iPad"])("recognises %s as a Mac", platform => {
    expect(detectMac({ platform })).toBe(true);
  });

  it.each(["Win32", "Linux x86_64"])("treats %s as another platform", platform => {
    expect(detectMac({ platform })).toBe(false);
  });

  it("falls back to the user agent when the platform is empty", () => {
    expect(detectMac({ platform: "", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)" })).toBe(true);
    expect(detectMac({ platform: "", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" })).toBe(false);
  });

  it("treats a missing navigator as another platform", () => {
    expect(detectMac(undefined)).toBe(false);
    expect(detectMac({})).toBe(false);
  });
});

describe(isMenuToggleKey.name, () => {
  it("toggles on ⌘K on a Mac and on Ctrl K elsewhere", () => {
    expect(isMenuToggleKey(keyDown({ key: "k", metaKey: true }), true)).toBe(true);
    expect(isMenuToggleKey(keyDown({ key: "k", ctrlKey: true }), false)).toBe(true);
  });

  it("ignores the other platform's modifier", () => {
    expect(isMenuToggleKey(keyDown({ key: "k", ctrlKey: true }), true)).toBe(false);
    expect(isMenuToggleKey(keyDown({ key: "k", metaKey: true }), false)).toBe(false);
  });

  it("accepts an uppercase K", () => {
    expect(isMenuToggleKey(keyDown({ key: "K", metaKey: true }), true)).toBe(true);
  });

  it("ignores the combination with Alt or Shift held", () => {
    expect(isMenuToggleKey(keyDown({ key: "k", metaKey: true, altKey: true }), true)).toBe(false);
    expect(isMenuToggleKey(keyDown({ key: "k", metaKey: true, shiftKey: true }), true)).toBe(false);
  });

  it("ignores other keys and K without a modifier", () => {
    expect(isMenuToggleKey(keyDown({ key: "j", metaKey: true }), true)).toBe(false);
    expect(isMenuToggleKey(keyDown({ key: "k" }), true)).toBe(false);
  });

  function keyDown(input: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }) {
    return { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...input };
  }
});

describe(isShortcutKey.name, () => {
  it("matches a letter whether or not caps lock is on", () => {
    expect(isShortcutKey({ key: "n", shiftKey: false }, ["N"])).toBe(true);
    expect(isShortcutKey({ key: "N", shiftKey: false }, ["N"])).toBe(true);
  });

  it("tells a shifted letter apart from the plain one", () => {
    expect(isShortcutKey({ key: "N", shiftKey: true }, ["N"])).toBe(false);
    expect(isShortcutKey({ key: "C", shiftKey: true }, ["shift", "C"])).toBe(true);
    expect(isShortcutKey({ key: "c", shiftKey: false }, ["shift", "C"])).toBe(false);
  });

  it("matches a symbol however it was typed", () => {
    expect(isShortcutKey({ key: "?", shiftKey: true }, ["?"])).toBe(true);
    expect(isShortcutKey({ key: "/", shiftKey: false }, ["?"])).toBe(false);
  });

  it("ignores other keys", () => {
    expect(isShortcutKey({ key: "m", shiftKey: false }, ["N"])).toBe(false);
  });
});

describe(useIsMac.name, () => {
  it("detects a Mac on the first render in the browser", () => {
    const { renders } = setup({ platform: "MacIntel" });

    expect(renders[0]).toBe(true);
  });

  it("detects another platform on the first render in the browser", () => {
    const { renders } = setup({ platform: "Win32" });

    expect(renders[0]).toBe(false);
  });

  it("knows nothing while rendering on the server, so hydration matches the server HTML", () => {
    setup({ platform: "MacIntel" });

    expect(renderToString(<PlatformProbe />)).toBe("unknown");
  });

  function PlatformProbe() {
    const isMac = useIsMac();
    return <>{isMac === undefined ? "unknown" : String(isMac)}</>;
  }

  function setup(input: { platform: string }) {
    const platform = vi.spyOn(navigator, "platform", "get").mockReturnValue(input.platform);
    onTestFinished(() => platform.mockRestore());
    const renders: Array<boolean | undefined> = [];

    renderHook(() => {
      const isMac = useIsMac();
      renders.push(isMac);
      return isMac;
    });

    return { renders };
  }
});
