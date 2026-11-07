import { browserEnvConfig } from "@src/config/browser-env.config";
import type { ServiceType } from "@src/types";
import { isTrialBlockedGpuSelection } from "@src/utils/deploymentData/v1beta3";

type GpuModel = NonNullable<ServiceType["profile"]["gpuModels"]>[number];

type TrialGpuSplit = { allowed: GpuModel[]; blocked: GpuModel[] };

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

/** Keeps only the GPU models a trial may use; undefined when a service would have none left, since which other GPU it needs is the user's call. */
export function dropTrialBlockedGpuModels(
  services: ServiceType[],
  blockedModels: readonly string[] = browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS
): ServiceType[] | undefined {
  const splits = services.map(service => splitTrialGpuModels(service, blockedModels));
  if (splits.some(({ allowed, blocked }) => blocked.length > 0 && allowed.length === 0)) return undefined;
  return services.map((service, index) => {
    const { allowed, blocked } = splits[index];
    return blocked.length > 0 ? { ...service, profile: { ...service.profile, gpuModels: allowed } } : service;
  });
}

export function describeTrialGpuBlocks(
  services: ServiceType[],
  blockedModels: readonly string[] = browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS
): string[] {
  return services.flatMap(service => {
    const { allowed, blocked } = splitTrialGpuModels(service, blockedModels);
    if (blocked.length === 0) return [];
    const labels = [...new Set(blocked.map(labelGpuModel))];
    const blockedGpus = `${listFormat.format(labels)}, which the free trial doesn't allow`;
    return allowed.length > 0
      ? [`Service "${service.title}" also accepts ${blockedGpus}. Remove ${labels.length > 1 ? "them" : "it"} from its GPU models.`]
      : [`Service "${service.title}" asks for ${blockedGpus}. Choose a GPU model your trial allows, or add credits.`];
  });
}

function splitTrialGpuModels(service: ServiceType, blockedModels: readonly string[]): TrialGpuSplit {
  const models = service.profile.hasGpu ? service.profile.gpuModels ?? [] : [];
  const isBlocked = (model: GpuModel) => isTrialBlockedGpuSelection(model.vendor, model.name, blockedModels);
  return { allowed: models.filter(model => !isBlocked(model)), blocked: models.filter(isBlocked) };
}

function labelGpuModel({ vendor, name }: GpuModel): string {
  return name ? `${vendor.toUpperCase()} ${name.toUpperCase()}` : `any ${vendor.toUpperCase()} GPU`;
}
