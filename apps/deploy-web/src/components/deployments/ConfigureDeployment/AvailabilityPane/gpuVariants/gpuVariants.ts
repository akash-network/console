import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { ScreeningRequest } from "@src/queries/useScreenedProviders";
import { toScreeningRequest } from "@src/queries/useScreenedProviders";
import type { SdlBuilderFormValuesType } from "@src/types";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import type { GpuModelCandidate } from "../gpuAvailability/gpuAvailability";
import { isPlacementGpuService } from "../gpuAvailability/gpuAvailability";

type Service = SdlBuilderFormValuesType["services"][number];

/** Makes the same form change as the GPU picker, so a variant screens exactly what switching to that model would. */
export function withGpuModel(
  values: SdlBuilderFormValuesType,
  placementId: string,
  model: Pick<GpuModelCandidate, "vendor" | "name">
): SdlBuilderFormValuesType {
  const gpuServiceIndex = values.services.findIndex(service => isPlacementGpuService(service, placementId));
  const targetIndex =
    gpuServiceIndex === -1 ? values.services.findIndex(service => service.placementId === placementId && !isLogCollectorService(service)) : gpuServiceIndex;

  return withServiceGpuModel(values, targetIndex, model);
}

/** A service already running that model keeps its pinned memory and interface, so its count stays the one the headline screens. */
export function withServiceGpuModel(
  values: SdlBuilderFormValuesType,
  serviceIndex: number,
  model: Pick<GpuModelCandidate, "vendor" | "name">
): SdlBuilderFormValuesType {
  const target = values.services[serviceIndex];
  if (!target || runsGpuModel(target, model)) return values;

  return { ...values, services: values.services.map((service, index) => (index === serviceIndex ? switchGpuModel(service, model) : service)) };
}

export function withoutGpu(values: SdlBuilderFormValuesType, placementId: string): SdlBuilderFormValuesType {
  return {
    ...values,
    services: values.services.map(service =>
      isPlacementGpuService(service, placementId) ? { ...service, profile: { ...service.profile, hasGpu: false, gpu: 0 } } : service
    )
  };
}

export function screeningRequestOf(values: SdlBuilderFormValuesType, placementName: string): ScreeningRequest | null {
  try {
    return toScreeningRequest(generateSdl(values), placementName);
  } catch {
    return null;
  }
}

function runsGpuModel(service: Service, model: Pick<GpuModelCandidate, "vendor" | "name">): boolean {
  const [firstModel] = service.profile.gpuModels ?? [];
  return !!service.profile.hasGpu && (service.profile.gpu ?? 0) > 0 && firstModel?.vendor === model.vendor && firstModel?.name === model.name;
}

function switchGpuModel(service: Service, model: Pick<GpuModelCandidate, "vendor" | "name">): Service {
  const [firstModel, ...otherModels] = service.profile.gpuModels ?? [];
  const pickedModel = { ...firstModel, vendor: model.vendor, name: model.name, memory: "", interface: "" };
  const gpu = service.profile.hasGpu && (service.profile.gpu ?? 0) > 0 ? service.profile.gpu : 1;

  return { ...service, profile: { ...service.profile, hasGpu: true, gpu, gpuModels: [pickedModel, ...otherModels] } };
}
