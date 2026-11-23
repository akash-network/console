import { describe, expect, it, vi } from "vitest";

import { useInAppBrowser } from "./useInAppBrowser";

import { renderHook } from "@testing-library/react";

describe(useInAppBrowser.name, () => {
  it("returns the in-app browser the user agent names", () => {
    const { result } = setup({ userAgent: "Mozilla/5.0 (Linux; Android 17; Pixel 8; wv) AppleWebKit/537.36 Mobile Safari/537.36 TwitterAndroid/12.28.0" });

    expect(result.current).toBe("X");
  });

  it("returns undefined in a regular browser", () => {
    const { result } = setup({ userAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36" });

    expect(result.current).toBeUndefined();
  });

  function setup(input: { userAgent: string }) {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(input.userAgent);
    return renderHook(() => useInAppBrowser());
  }
});
