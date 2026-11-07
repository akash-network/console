import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ConfigureFormHandle } from "./configureFormRegistry";
import { ConfigureFormRegistry, useConfigureFormRegistry, useIsConfigureFormOpen } from "./configureFormRegistry";

import { act, renderHook } from "@testing-library/react";

describe(ConfigureFormRegistry.name, () => {
  it("holds the published form until it is withdrawn, telling every listener", () => {
    const registry = new ConfigureFormRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    const form = mock<ConfigureFormHandle>();

    const withdraw = registry.publish(form);
    expect(registry.current).toBe(form);
    expect(listener).toHaveBeenCalledTimes(1);

    withdraw();
    expect(registry.current).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("keeps a newer form when an older one is withdrawn", () => {
    const registry = new ConfigureFormRegistry();
    const withdrawOlder = registry.publish(mock<ConfigureFormHandle>());
    const newer = mock<ConfigureFormHandle>();
    registry.publish(newer);
    const listener = vi.fn();
    registry.subscribe(listener);

    withdrawOlder();

    expect(registry.current).toBe(newer);
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops telling a listener that unsubscribed", () => {
    const registry = new ConfigureFormRegistry();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);

    unsubscribe();
    registry.publish(mock<ConfigureFormHandle>());

    expect(listener).not.toHaveBeenCalled();
  });

  it("shares one registry across the app", () => {
    const { result } = renderHook(() => [useConfigureFormRegistry(), useConfigureFormRegistry()]);

    expect(result.current[0]).toBe(result.current[1]);
    expect(result.current[0]).toBeInstanceOf(ConfigureFormRegistry);
  });

  describe(useIsConfigureFormOpen.name, () => {
    it("follows whether a form is published", () => {
      const registry = new ConfigureFormRegistry();
      const { result } = renderHook(() => useIsConfigureFormOpen(registry));
      expect(result.current).toBe(false);

      let withdraw: () => void = () => undefined;
      act(() => {
        withdraw = registry.publish(mock<ConfigureFormHandle>());
      });
      expect(result.current).toBe(true);

      act(() => withdraw());
      expect(result.current).toBe(false);
    });
  });
});
