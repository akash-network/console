import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { isServiceConfigured, useServiceStatus } from "./useServiceStatus";

import { renderHook } from "@testing-library/react";

describe("isServiceConfigured", () => {
  it("reports a fresh default service as incomplete", () => {
    expect(isServiceConfigured(defaultServiceWithPlacement(), 0)).toBe(false);
  });

  it("reports a fully specified service as configured", () => {
    expect(isServiceConfigured(defaultServiceWithPlacement({ image: "nginx:latest" }), 0)).toBe(true);
  });

  it("ignores issues belonging to placements", () => {
    const values = defaultServiceWithPlacement({ image: "nginx:latest" });
    values.placements[0].name = "";

    expect(isServiceConfigured(values, 0)).toBe(true);
  });

  it("reports a missing service index as incomplete", () => {
    expect(isServiceConfigured(defaultServiceWithPlacement(), 5)).toBe(false);
  });
});

describe("useServiceStatus", () => {
  it("derives the flag from the form context", () => {
    const { result } = setup({ values: defaultServiceWithPlacement({ image: "nginx:latest" }), serviceIndex: 0 });

    expect(result.current).toBe(true);
  });

  it("reports an incomplete service through the form context", () => {
    const { result } = setup({ values: defaultServiceWithPlacement(), serviceIndex: 0 });

    expect(result.current).toBe(false);
  });

  function setup(input: { values: SdlBuilderFormValuesType; serviceIndex: number }) {
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: input.values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    return renderHook(() => useServiceStatus(input.serviceIndex), { wrapper: Wrapper });
  }
});
