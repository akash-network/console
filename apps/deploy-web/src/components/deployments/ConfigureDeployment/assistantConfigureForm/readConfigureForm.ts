import type {
  ConfigureFormPlacementScreening,
  ConfigureFormRead,
  ConfigureFormServiceRead
} from "@src/components/assistant/configureFormRegistry/configureFormRegistry";
import type { PlacementType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import type { DeploymentFlowPhase } from "../useDeploymentFlow/useDeploymentFlow";
import { listSpecIssueMessages } from "../useRequestQuotes/invalidFieldMessages";

type StorageVolume = ServiceType["profile"]["storage"][number];

const EDITABLE_PHASES: DeploymentFlowPhase[] = ["configuring", "error"];

export function isEditablePhase(phase: DeploymentFlowPhase): boolean {
  return EDITABLE_PHASES.includes(phase);
}

export function readConfigureForm(
  values: SdlBuilderFormValuesType,
  { phase, providers }: { phase: DeploymentFlowPhase; providers: ConfigureFormPlacementScreening[] }
): ConfigureFormRead {
  return {
    phase,
    editable: isEditablePhase(phase),
    services: values.services.map(service => serviceReadOf(service, values.placements)),
    placements: values.placements.map(({ name, regions, attributes }) => ({
      name,
      regions: regions ?? [],
      attributes: (attributes ?? []).map(({ key, value }) => ({ key, value }))
    })),
    invalidSettings: listSpecIssueMessages(values),
    providers,
    screeningSdl: screeningSdlOf(values)
  };
}

function serviceReadOf(service: ServiceType, placements: PlacementType[]): ConfigureFormServiceRead {
  const { profile } = service;
  const [ephemeral, ...volumes] = profile.storage;
  const ramVolume = volumes.find(isRamVolume);

  return {
    name: service.title,
    placement: placements.find(placement => placement.id === service.placementId)?.name ?? null,
    image: service.image || null,
    replicas: service.count,
    cpu: profile.cpu,
    cpuArch: profile.arch ?? null,
    memory: `${profile.ram}${profile.ramUnit}`,
    ephemeralStorage: sizeOf(ephemeral),
    ramStorage: ramVolume ? { size: sizeOf(ramVolume), mount: ramVolume.mount || null } : null,
    persistentStorage: volumes
      .filter(volume => !isRamVolume(volume))
      .map(volume => ({
        name: volume.name || null,
        class: volume.type ?? null,
        size: sizeOf(volume),
        mount: volume.mount || null,
        readOnly: !!volume.isReadOnly
      })),
    gpu: profile.hasGpu
      ? { units: profile.gpu ?? 0, models: (profile.gpuModels ?? []).map(({ vendor, name }) => [vendor, name].filter(Boolean).join("/")) }
      : null,
    ports: service.expose.map(({ port, as, proto, global }) => ({ port, as: as ?? null, proto: proto ?? null, global: !!global })),
    envNames: (service.env ?? []).map(({ key }) => key.trim()).filter(Boolean),
    hasCommand: hasCommand(service)
  };
}

export function isRamVolume(volume: StorageVolume): boolean {
  return volume.type === "ram";
}

function sizeOf({ size, unit }: StorageVolume): string {
  return `${size}${unit}`;
}

function hasCommand({ command }: ServiceType): boolean {
  return !!(command?.command || command?.arg || command?.importedCommand?.length || command?.importedArg?.length);
}

/** Built without env, command, registry credentials and SSH key, which screening never reads and the assistant must not see. */
function screeningSdlOf(values: SdlBuilderFormValuesType): string | null {
  try {
    return generateSdl({
      ...values,
      hasSSHKey: false,
      services: values.services.map(service => ({
        ...service,
        env: [],
        command: { command: "", arg: "" },
        hasCredentials: false,
        credentials: undefined,
        sshPubKey: ""
      }))
    });
  } catch {
    return null;
  }
}
