import { setTimeout as wait } from "node:timers/promises";

import { useInjectedConfig } from "./useInjectedConfig";

import { act, renderHook } from "@testing-library/react";

describe(useInjectedConfig.name, () => {
  it("returns null config and isLoaded=true when no injected config exists", () => {
    const hasConfig = jest.fn().mockReturnValue(false);
    const decodeConfig = jest.fn().mockResolvedValue(null);
    const { result } = renderHook(() =>
      useInjectedConfig({
        hasConfig,
        decodeConfig
      })
    );

    expect(result.current).toEqual({ config: null, isLoaded: true });
    expect(decodeConfig).not.toHaveBeenCalled();
  });

  it("returns decoded config and isLoaded=true when injected config exists", async () => {
    const mockConfig = { NEXT_PUBLIC_TURNSTILE_ENABLED: true };
    const { result } = renderHook(() =>
      useInjectedConfig({
        hasConfig: () => true,
        decodeConfig: () => Promise.resolve(mockConfig)
      })
    );
    expect(result.current).toEqual({ config: null, isLoaded: false });

    await act(() => wait(0));

    expect(result.current).toEqual({ config: mockConfig, isLoaded: true });
  });
});
