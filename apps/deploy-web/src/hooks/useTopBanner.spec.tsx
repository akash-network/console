import { createStore, Provider as JotaiProvider } from "jotai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useGenericBannerVisibility } from "./useTopBanner";

import { act, renderHook } from "@testing-library/react";

const DISMISSED_KEY_PREFIX = "generic_banner_dismissed:";

describe("useGenericBannerVisibility", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("opens the banner when the flag is enabled and not dismissed", async () => {
    const { result } = await setup({ isFlagEnabled: true, dismissId: "console-air" });
    expect(result.current[0]).toBe(true);
  });

  it("does not open the banner when the flag is disabled", async () => {
    const { result } = await setup({ isFlagEnabled: false, dismissId: "console-air" });
    expect(result.current[0]).toBe(false);
  });

  it("keeps the banner closed when the dismissId is already persisted", async () => {
    window.localStorage.setItem(DISMISSED_KEY_PREFIX + "console-air", "true");
    const { result } = await setup({ isFlagEnabled: true, dismissId: "console-air" });
    expect(result.current[0]).toBe(false);
  });

  it("persists dismiss to localStorage when closed with a dismissId", async () => {
    const { result } = await setup({ isFlagEnabled: true, dismissId: "console-air" });
    expect(result.current[0]).toBe(true);

    await act(async () => {
      result.current[1](false);
    });

    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem(DISMISSED_KEY_PREFIX + "console-air")).toBe("true");
  });

  it("does not write to localStorage when dismissed without a dismissId", async () => {
    const { result } = await setup({ isFlagEnabled: true, dismissId: undefined });

    await act(async () => {
      result.current[1](false);
    });

    expect(result.current[0]).toBe(false);
    expect(window.localStorage.length).toBe(0);
  });

  it("re-opens the banner when the dismissId changes (new announcement)", async () => {
    window.localStorage.setItem(DISMISSED_KEY_PREFIX + "old", "true");
    const { result, rerender } = await setup({ isFlagEnabled: true, dismissId: "old" });
    expect(result.current[0]).toBe(false);

    await act(async () => {
      rerender({ isFlagEnabled: true, dismissId: "new" });
    });

    expect(result.current[0]).toBe(true);
  });

  async function setup(initialProps: { isFlagEnabled: boolean; dismissId: string | undefined }) {
    const store = createStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => <JotaiProvider store={store}>{children}</JotaiProvider>;

    const result = renderHook((props: { isFlagEnabled: boolean; dismissId: string | undefined }) => useGenericBannerVisibility(props), {
      wrapper,
      initialProps
    });
    await act(async () => {});
    return result;
  }
});
