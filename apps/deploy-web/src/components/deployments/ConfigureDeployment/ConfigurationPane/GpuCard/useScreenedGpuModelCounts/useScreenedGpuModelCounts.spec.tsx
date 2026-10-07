import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { KeyedScreeningRequest, ScreeningRequest } from "@src/queries/useScreenedProviders";
import { toScreeningRequest } from "@src/queries/useScreenedProviders";
import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import type { DEPENDENCIES, ScreenedGpuModel } from "./useScreenedGpuModelCounts";
import { useScreenedGpuModelCounts } from "./useScreenedGpuModelCounts";

import { renderHook } from "@testing-library/react";

describe(useScreenedGpuModelCounts.name, () => {
  it("returns what screening counts for each model", () => {
    const { result } = setup({ models: [{ vendor: "nvidia", name: "h100" }] });

    expect(result.current).toEqual([{ count: 3, gpuCount: 11, isLoading: false }]);
  });

  it("screens the configuration with only this service switched to each model, within its placement's regions", () => {
    const { screened } = setup({
      models: [
        { vendor: "nvidia", name: "h100" },
        { vendor: "nvidia", name: "t4" }
      ],
      regions: ["eu-west", "na-us-west"]
    });

    expect(screened().map(({ key }) => key)).toEqual(["nvidia/h100", "nvidia/t4"]);
    expect(screened().map(({ regions }) => regions)).toEqual([
      ["eu-west", "na-us-west"],
      ["eu-west", "na-us-west"]
    ]);
    expect(screened().map(({ request }) => gpuModelsOf(request!))).toEqual([
      [["vendor/nvidia/model/h100"], []],
      [["vendor/nvidia/model/t4"], []]
    ]);
  });

  it("screens the configuration as it is for the model the service already runs", () => {
    const { screened, values } = setup({ models: [{ vendor: "nvidia", name: "a100" }] });

    expect(screened()[0].request).toEqual(toScreeningRequest(generateSdl(values), "gpu-pool"));
  });

  it("asks for nothing for a service the form does not have", () => {
    const { screened } = setup({ models: [{ vendor: "nvidia", name: "h100" }], serviceIndex: 5 });

    expect(screened()).toEqual([{ key: "nvidia/h100", request: null, regions: undefined }]);
  });

  it("screens nothing while no model is asked for", () => {
    const { screened } = setup({ models: [] });

    expect(screened()).toEqual([]);
  });

  it("screens the models asked for once they arrive", () => {
    const { screened, rerender } = setup({ models: [] });

    rerender({ models: [{ vendor: "nvidia", name: "h100" }] });

    expect(screened().map(({ key }) => key)).toEqual(["nvidia/h100"]);
  });

  function setup(input: { models: ScreenedGpuModel[]; serviceIndex?: number; regions?: string[] }) {
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
    const useScreenedProviderCounts = vi.fn<typeof DEPENDENCIES.useScreenedProviderCounts>(requests =>
      requests.map(() => ({ count: 3, gpuCount: 11, isLoading: false }))
    );
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    const view = renderHook(({ models }) => useScreenedGpuModelCounts(input.serviceIndex ?? 0, models, { useScreenedProviderCounts }), {
      wrapper: Wrapper,
      initialProps: { models: input.models }
    });

    return {
      result: view.result,
      rerender: view.rerender,
      values,
      screened: (): KeyedScreeningRequest[] => useScreenedProviderCounts.mock.lastCall![0]
    };
  }
});

function gpuModelsOf(request: ScreeningRequest): string[][] {
  return request.resources.map(({ resource }) => (resource.gpu.attributes ?? []).map(attribute => attribute.key));
}
