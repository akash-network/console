import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { useDeploymentHasGpu } from "./useDeploymentResourceSummary";

import { renderHook } from "@testing-library/react";

describe(useDeploymentHasGpu.name, () => {
  it("returns true when a service requests a GPU", () => {
    const { result } = setup({ hasGpu: true, gpu: 1 });

    expect(result.current).toBe(true);
  });

  it("returns false when no service requests a GPU", () => {
    const { result } = setup({ hasGpu: false });

    expect(result.current).toBe(false);
  });

  it("returns false when the GPU flag is off even if a gpu count lingers", () => {
    const { result } = setup({ hasGpu: false, gpu: 2 });

    expect(result.current).toBe(false);
  });

  function setup(input: { hasGpu: boolean; gpu?: number }) {
    const base = defaultServiceWithPlacement({ image: "nginx:latest" });
    const values = {
      ...base,
      services: base.services.map((service, index) =>
        index === 0 ? { ...service, profile: { ...service.profile, hasGpu: input.hasGpu, gpu: input.gpu ?? 0 } } : service
      )
    };

    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    return renderHook(() => useDeploymentHasGpu(), { wrapper: Wrapper });
  }
});
