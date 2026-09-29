import { describe, expect, it } from "vitest";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import { toScreeningRequest } from "@src/queries/useScreenedProviders";
import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { GPU_INTERCONNECT_CAPABILITY_KEY } from "@src/utils/sdl/gpuInterconnect";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { screeningRequestOf, withGpuModel, withoutGpu } from "./gpuVariants";

type Service = SdlBuilderFormValuesType["services"][number];

const H100 = { vendor: "nvidia", name: "h100" };

describe(withGpuModel.name, () => {
  it("switches the placement's gpu service to the model and clears its memory and interface pins", () => {
    const values = gpuForm({
      gpu: 2,
      gpuModels: [
        { vendor: "nvidia", name: "a100", memory: "80Gi", interface: "sxm" },
        { vendor: "nvidia", name: "t4" }
      ]
    });

    const switched = withGpuModel(values, "p1", H100);

    expect(switched.services[0].profile).toMatchObject({
      hasGpu: true,
      gpu: 2,
      interconnect: {},
      gpuModels: [
        { vendor: "nvidia", name: "h100", memory: "", interface: "" },
        { vendor: "nvidia", name: "t4" }
      ]
    });
  });

  it("switches the vendor along with the model", () => {
    const values = gpuForm({ gpuModels: [{ vendor: "nvidia", name: "a100" }] });

    expect(withGpuModel(values, "p1", { vendor: "amd", name: "mi300" }).services[0].profile.gpuModels).toEqual([
      { vendor: "amd", name: "mi300", memory: "", interface: "" }
    ]);
  });

  it("turns a switched-off gpu back on with one unit and keeps its models", () => {
    const values = gpuForm({ hasGpu: false, gpu: 0, gpuModels: [{ vendor: "nvidia", name: "a100" }] });

    expect(withGpuModel(values, "p1", H100).services[0].profile).toMatchObject({
      hasGpu: true,
      gpu: 1,
      gpuModels: [{ vendor: "nvidia", name: "h100", memory: "", interface: "" }]
    });
  });

  it("seeds a model for a service that has none", () => {
    const values = gpuForm({ hasGpu: false, gpuModels: [] });

    expect(withGpuModel(values, "p1", H100).services[0].profile.gpuModels).toEqual([{ vendor: "nvidia", name: "h100", memory: "", interface: "" }]);
  });

  it("switches the gpu service rather than the first service of the placement", () => {
    const values = form([cpuService("p1", "web"), gpuService("p1", "worker", [{ vendor: "nvidia", name: "a100" }])]);

    const switched = withGpuModel(values, "p1", H100);

    expect(switched.services[0]).toBe(values.services[0]);
    expect(switched.services[1].profile.gpuModels?.[0].name).toBe("h100");
  });

  it("adds the gpu to the placement's first service while none has one, skipping log collectors and other placements", () => {
    const logCollector = { ...cpuService("p1", "web-log-collector"), image: LOG_COLLECTOR_IMAGE };
    const values = form([cpuService("p2", "other"), logCollector, cpuService("p1", "web")]);

    const switched = withGpuModel(values, "p1", H100);

    expect(switched.services[0]).toBe(values.services[0]);
    expect(switched.services[1]).toBe(logCollector);
    expect(switched.services[2].profile).toMatchObject({ hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "h100" }] });
  });

  it("returns the form unchanged when the placement has no service", () => {
    const values = gpuForm({});

    expect(withGpuModel(values, "missing", H100)).toBe(values);
  });
});

describe(withoutGpu.name, () => {
  it("turns off every gpu of the placement and leaves other placements alone", () => {
    const otherPlacement = gpuService("p2", "other", [{ vendor: "nvidia", name: "t4" }]);
    const values = form([
      gpuService("p1", "web", [{ vendor: "nvidia", name: "a100" }]),
      gpuService("p1", "worker", [{ vendor: "nvidia", name: "h100" }]),
      otherPlacement
    ]);

    const switched = withoutGpu(values, "p1");

    expect(switched.services.map(service => [service.profile.hasGpu, service.profile.gpu])).toEqual([
      [false, 0],
      [false, 0],
      [true, 1]
    ]);
    expect(switched.services[0].profile.gpuModels).toEqual([{ vendor: "nvidia", name: "a100" }]);
    expect(switched.services[2]).toBe(otherPlacement);
  });
});

describe(screeningRequestOf.name, () => {
  it("sends the request the headline screens once the picker has switched to that model", () => {
    const onA100 = gpuForm({ gpuModels: [{ vendor: "nvidia", name: "a100", memory: "80Gi", interface: "sxm" }] });
    const onH100 = gpuForm({ gpuModels: [{ vendor: "nvidia", name: "h100", memory: "", interface: "" }] });
    const headlineRequest = toScreeningRequest(generateSdl(onH100), "dcloud");

    expect(headlineRequest?.resources[0].resource.gpu.attributes).toContainEqual({ key: "vendor/nvidia/model/h100", value: "true" });
    expect(screeningRequestOf(withGpuModel(onA100, "p1", H100), "dcloud")).toEqual(headlineRequest);
  });

  it("keeps the interconnect requirement on a switched model", () => {
    const request = screeningRequestOf(withGpuModel(gpuForm({ gpuModels: [{ vendor: "nvidia", name: "a100" }] }), "p1", H100), "dcloud");

    expect(request?.requirements?.attributes).toContainEqual({ key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" });
    expect(request?.resources[0].resource.gpu.attributes).toContainEqual({ key: "vendor/nvidia/model/h100", value: "true" });
  });

  it("returns null when the form can't be written as an SDL", () => {
    const values = gpuForm({});
    const broken = { ...values, services: [{ ...values.services[0], profile: { ...values.services[0].profile, storage: [] } }] };

    expect(screeningRequestOf(broken, "dcloud")).toBeNull();
  });

  it("returns null for a placement the SDL doesn't have", () => {
    expect(screeningRequestOf(gpuForm({}), "missing")).toBeNull();
  });
});

function gpuForm(input: { hasGpu?: boolean; gpu?: number; gpuModels?: Service["profile"]["gpuModels"] }): SdlBuilderFormValuesType {
  const service = gpuService("p1", "web", input.gpuModels ?? [{ vendor: "nvidia", name: "a100" }]);
  return form(
    [{ ...service, profile: { ...service.profile, hasGpu: input.hasGpu ?? true, gpu: input.gpu ?? 1, interconnect: {} } }],
    [{ id: "a1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }]
  );
}

function form(services: Service[], attributes: SdlBuilderFormValuesType["placements"][number]["attributes"] = []): SdlBuilderFormValuesType {
  return {
    placements: [defaultPlacement({ id: "p1", name: "dcloud", attributes }), defaultPlacement({ id: "p2", name: "other" })],
    endpoints: [],
    services
  };
}

function gpuService(placementId: string, title: string, gpuModels: Service["profile"]["gpuModels"]): Service {
  const service = cpuService(placementId, title);
  return { ...service, profile: { ...service.profile, hasGpu: true, gpu: 1, gpuModels } };
}

function cpuService(placementId: string, title: string): Service {
  return defaultService(placementId, { title, image: "nginx" });
}
