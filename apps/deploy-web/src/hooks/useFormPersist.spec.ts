import { describe, expect, it, vi } from "vitest";

import { UACT_DENOM } from "@src/config/denom.config";
import { defaultPricing, healSdlBuilderDraft } from "@src/utils/sdl/data";
import useFormPersist from "./useFormPersist";

import { renderHook } from "@testing-library/react";

describe(useFormPersist.name, () => {
  it("applies transform to restored values before setting them on the form", () => {
    const transform = vi.fn((values: Record<string, any>) => ({ ...values, services: "transformed" }));
    const { setValue } = setup({
      stored: JSON.stringify({ _timestamp: 123, services: "stale" }),
      transform
    });

    expect(transform).toHaveBeenCalledWith({ services: "stale" });
    expect(setValue).toHaveBeenCalledWith("services", "transformed", expect.any(Object));
  });

  it("restores values unchanged when no transform is given", () => {
    const { setValue } = setup({ stored: JSON.stringify({ services: "stale" }) });

    expect(setValue).toHaveBeenCalledWith("services", "stale", expect.any(Object));
  });

  it("recovers from corrupted storage by clearing it and applying the default values", () => {
    const { setValue } = setup({
      stored: "{not-json",
      defaultValues: { services: "defaults" }
    });

    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBe("{not-json");
    expect(setValue).toHaveBeenCalledWith("services", "defaults", expect.any(Object));
  });

  it("heals a pre-uact draft missing service pricing when given the sdl-builder transform", () => {
    const preUactDraft = {
      placements: [{ id: "p1", name: "dcloud" }],
      services: [{ id: "s1", title: "web", image: "nginx", profile: { cpu: 0.1 }, expose: [], placementId: "p1" }],
      endpoints: []
    };
    const { setValue } = setup({
      stored: JSON.stringify(preUactDraft),
      transform: healSdlBuilderDraft
    });

    expect(setValue).toHaveBeenCalledWith(
      "services",
      [expect.objectContaining({ image: "nginx", pricing: { amount: defaultPricing().amount, denom: UACT_DENOM } })],
      expect.any(Object)
    );
  });

  const STORAGE_KEY = "test-form";

  function setup(input?: { stored?: string; transform?: (values: Record<string, any>) => Record<string, any>; defaultValues?: Record<string, any> }) {
    window.localStorage.clear();

    if (input?.stored !== undefined) {
      window.localStorage.setItem(STORAGE_KEY, input.stored);
    }

    const watch = vi.fn();
    const setValue = vi.fn();

    const rendered = renderHook(() =>
      useFormPersist(STORAGE_KEY, {
        watch,
        setValue,
        storage: window.localStorage,
        defaultValues: input?.defaultValues,
        transform: input?.transform
      })
    );

    return { watch, setValue, rendered };
  }
});
