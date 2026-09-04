import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { CpuArchType, SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { useDeploymentCpuArch, useDeploymentGpuCount, useDeploymentHasGpu } from "./useDeploymentResourceSummary";

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

describe(useDeploymentCpuArch.name, () => {
  it("returns the architecture a service requests", () => {
    const { result } = setup({ services: [{ arch: "arm64" }] });

    expect(result.current).toBe("arm64");
  });

  it("returns undefined when no service requests an architecture", () => {
    const { result } = setup({ services: [{}] });

    expect(result.current).toBeUndefined();
  });

  it("ignores a service in another placement", () => {
    const { result } = setup({ services: [{ arch: "arm64", placementId: "other-placement" }], scopeTo: "placement-1" });

    expect(result.current).toBeUndefined();
  });

  it("returns the architecture shared by every service that requests one", () => {
    const { result } = setup({ services: [{ arch: "arm64" }, {}, { arch: "arm64" }] });

    expect(result.current).toBe("arm64");
  });

  it("returns undefined when scoped services request different architectures", () => {
    const { result } = setup({ services: [{ arch: "arm64" }, { arch: "amd64" }] });

    expect(result.current).toBeUndefined();
  });

  function setup(input: { services: Array<{ arch?: CpuArchType; placementId?: string }>; scopeTo?: string }) {
    const placement = defaultPlacement();
    const values: SdlBuilderFormValuesType = {
      placements: [placement],
      endpoints: [],
      services: input.services.map(service => {
        const built = defaultService(service.placementId ?? placement.id, { image: "nginx:latest" });
        return { ...built, profile: { ...built.profile, arch: service.arch } };
      })
    };

    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    return renderHook(() => useDeploymentCpuArch(input.scopeTo), { wrapper: Wrapper });
  }
});
