import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { useDeploymentGpuCount, useDeploymentHasGpu } from "./useDeploymentResourceSummary";

import { renderHook } from "@testing-library/react";

describe(useDeploymentGpuCount.name, () => {
  it("counts GPUs across the whole spec when no placement is given", () => {
    const { result } = setup();

    expect(result.current).toBe(3);
  });

  it("counts only the given placement's GPUs", () => {
    const { result } = setup("placement-a");

    expect(result.current).toBe(2);
  });

  it("returns zero for a placement with no GPUs", () => {
    const { result } = setup("placement-b");

    expect(result.current).toBe(0);
  });

  function setup(placementId?: string) {
    const values: SdlBuilderFormValuesType = {
      placements: [],
      endpoints: [],
      services: [withGpu(defaultService("placement-a"), 2), withGpu(defaultService("placement-b"), 0), withGpu(defaultService("placement-c"), 1)]
    };

    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    return renderHook(() => useDeploymentGpuCount(placementId), { wrapper: Wrapper });
  }

  function withGpu(service: ReturnType<typeof defaultService>, gpu: number) {
    return { ...service, profile: { ...service.profile, hasGpu: gpu > 0, gpu } };
  }
});

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
