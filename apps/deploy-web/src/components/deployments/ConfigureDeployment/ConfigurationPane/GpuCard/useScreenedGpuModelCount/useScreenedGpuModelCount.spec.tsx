import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { KeyedScreeningRequest, ScreeningRequest } from "@src/queries/useScreenedProviders";
import { toScreeningRequest } from "@src/queries/useScreenedProviders";
import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import type { DEPENDENCIES } from "./useScreenedGpuModelCount";
import { useScreenedGpuModelCount } from "./useScreenedGpuModelCount";

import { renderHook } from "@testing-library/react";

describe(useScreenedGpuModelCount.name, () => {
  it("returns what screening counts for the model", () => {
    const { result } = setup({ model: { vendor: "nvidia", name: "h100" } });

    expect(result.current).toEqual({ count: 3, gpuCount: 11, isLoading: false });
  });

  it("screens the configuration with only this service switched to the model, within its placement's regions", () => {
    const { screened } = setup({ model: { vendor: "nvidia", name: "h100" }, regions: ["eu-west", "na-us-west"] });

    expect(screened().key).toBe("nvidia/h100");
    expect(screened().regions).toEqual(["eu-west", "na-us-west"]);
    expect(gpuModelsOf(screened().request!)).toEqual([["vendor/nvidia/model/h100"], []]);
  });

  it("screens the configuration as it is for the model the service already runs", () => {
    const { screened, values } = setup({ model: { vendor: "nvidia", name: "a100" } });

    expect(screened().request).toEqual(toScreeningRequest(generateSdl(values), "gpu-pool"));
  });

  it("asks for nothing for a service the form does not have", () => {
    const { screened } = setup({ model: { vendor: "nvidia", name: "h100" }, serviceIndex: 5 });

    expect(screened()).toEqual({ key: "nvidia/h100", request: null, regions: undefined });
  });

  function setup(input: { model: { vendor: string; name: string }; serviceIndex?: number; regions?: string[] }) {
    const placement = defaultPlacement({ name: "gpu-pool", regions: input.regions });
    const gpuService = defaultService(placement.id, { title: "web", image: "nginx" });
    const values: SdlBuilderFormValuesType = {
      placements: [placement],
      endpoints: [],
      services: [
        {
          ...gpuService,
          profile: { ...gpuService.profile, hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "80Gi", interface: "" }] }
        },
        defaultService(placement.id, { title: "worker", image: "nginx" })
      ]
    };
    const useScreenedProviderCounts = vi.fn<typeof DEPENDENCIES.useScreenedProviderCounts>(() => [{ count: 3, gpuCount: 11, isLoading: false }]);
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    const view = renderHook(() => useScreenedGpuModelCount(input.serviceIndex ?? 0, input.model, { useScreenedProviderCounts }), { wrapper: Wrapper });

    return {
      result: view.result,
      values,
      screened: (): KeyedScreeningRequest => useScreenedProviderCounts.mock.lastCall![0][0]
    };
  }
});

function gpuModelsOf(request: ScreeningRequest): string[][] {
  return request.resources.map(({ resource }) => (resource.gpu.attributes ?? []).map(attribute => attribute.key));
}
