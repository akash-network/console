import type { ConfigureFormEdit } from "@src/components/assistant/configureFormRegistry/configureFormRegistry";
import type { PlacementType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { memoryUnits, storageUnits } from "@src/utils/akash/units";
import { defaultPersistentStorage } from "@src/utils/sdl/data";
import { isRamVolume } from "./readConfigureForm";

type ServiceChanges = ConfigureFormEdit["services"][number]["changes"];
type PlacementChanges = ConfigureFormEdit["placements"][number]["changes"];
type PersistentStorageChange = NonNullable<ServiceChanges["persistentStorage"]>;
type StorageVolume = ServiceType["profile"]["storage"][number];
type GpuModel = NonNullable<ServiceType["profile"]["gpuModels"]>[number];

/** The API takes Kubernetes style sizes, while the form spells decimal units out. */
const FORM_UNIT_OF_SUFFIX: Record<string, string> = { M: "MB", G: "GB", T: "TB" };

export class ConfigureFormEditError extends Error {}

/** Applies only the fields the edit names, so env values, secrets, pricing and everything else stay as the user left them. */
export function applyConfigureFormEdit(values: SdlBuilderFormValuesType, edit: ConfigureFormEdit): SdlBuilderFormValuesType {
  const services = [...values.services];
  for (const { service: title, changes } of edit.services) {
    const index = services.findIndex(service => service.title === title);
    if (index === -1) throw new ConfigureFormEditError(`The form has no service named "${title}". Its services are: ${namesOf(services.map(s => s.title))}.`);
    services[index] = editedService(services[index], changes);
  }

  const placements = [...values.placements];
  for (const { placement: name, changes } of edit.placements) {
    const index = placements.findIndex(placement => placement.name === name);
    if (index === -1)
      throw new ConfigureFormEditError(`The form has no placement named "${name}". Its placements are: ${namesOf(placements.map(p => p.name))}.`);
    placements[index] = editedPlacement(placements[index], changes);
  }

  return { ...values, services, placements };
}

function editedService(service: ServiceType, changes: ServiceChanges): ServiceType {
  let profile = { ...service.profile };
  if (changes.cpu !== undefined) profile.cpu = changes.cpu;
  if (changes.memory) {
    const memory = formSizeOf(changes.memory, memoryUnits);
    profile = { ...profile, ram: memory.size, ramUnit: memory.unit };
  }
  if (changes.ephemeralStorage) {
    const [ephemeral, ...volumes] = profile.storage;
    profile.storage = [{ ...ephemeral, ...formSizeOf(changes.ephemeralStorage, storageUnits) }, ...volumes];
  }
  if (changes.gpu) profile = { ...profile, ...gpuProfileOf(changes.gpu, profile.gpuModels) };
  if (changes.persistentStorage) profile.storage = editedStorage(profile.storage, changes.persistentStorage);

  return { ...service, image: changes.image ?? service.image, count: changes.count ?? service.count, profile };
}

function gpuProfileOf(gpu: NonNullable<ServiceChanges["gpu"]>, currentModels: ServiceType["profile"]["gpuModels"]): Partial<ServiceType["profile"]> {
  if (gpu.units === 0) return { hasGpu: false };

  const models = gpu.models?.map(model => requestedGpuModelOf(model, currentModels ?? []));
  return { hasGpu: true, gpu: gpu.units, gpuModels: models ?? currentModels };
}

/** The read reports models as vendor/name only, so a model the edit repeats keeps the memory and interface the form already asks for. */
function requestedGpuModelOf(model: string, currentModels: GpuModel[]): GpuModel {
  const [vendor, name] = model.split("/");
  const current = currentModels.find(currentModel => currentModel.vendor === vendor && (currentModel.name || undefined) === name);
  return current ?? (name ? { vendor, name } : { vendor });
}

function editedStorage(storage: StorageVolume[], change: PersistentStorageChange): StorageVolume[] {
  const persistentIndexes = storage.flatMap((volume, index) => (index > 0 && !isRamVolume(volume) ? [index] : []));
  const targetIndex = change.name ? persistentIndexes.find(index => storage[index].name === change.name) : persistentIndexes[0];
  const isMissingNamedVolume = !!change.name && targetIndex === undefined && persistentIndexes.length > 0;

  if (change.remove) {
    if (change.name && targetIndex === undefined) throw missingVolumeError(change.name, storage, persistentIndexes);
    const removed = change.name ? [targetIndex] : persistentIndexes;
    return storage.filter((_, index) => !removed.includes(index));
  }
  if (isMissingNamedVolume) throw missingVolumeError(change.name as string, storage, persistentIndexes);

  const volume = targetIndex === undefined ? { ...defaultPersistentStorage, name: change.name ?? defaultPersistentStorage.name } : storage[targetIndex];
  const edited: StorageVolume = {
    ...volume,
    ...(change.size && formSizeOf(change.size, storageUnits)),
    ...(change.class && { type: change.class }),
    ...(change.mount && { mount: change.mount }),
    ...(change.readOnly !== undefined && { isReadOnly: change.readOnly })
  };

  return targetIndex === undefined ? [...storage, edited] : storage.map((existing, index) => (index === targetIndex ? edited : existing));
}

function missingVolumeError(name: string, storage: StorageVolume[], persistentIndexes: number[]): ConfigureFormEditError {
  return new ConfigureFormEditError(
    `The form has no persistent volume named "${name}". Its volumes are: ${namesOf(persistentIndexes.map(index => storage[index].name ?? ""))}.`
  );
}

function editedPlacement(placement: PlacementType, changes: PlacementChanges): PlacementType {
  return {
    ...placement,
    ...(changes.attributes && { attributes: changes.attributes.map(({ key, value }) => ({ key, value })) }),
    ...(changes.regions && { regions: changes.regions })
  };
}

function formSizeOf(value: string, units: { suffix: string }[]): { size: number; unit: string } {
  const [, amount, suffix] = /^(\d+(?:\.\d+)?)([A-Za-z]+)$/.exec(value) ?? [];
  const unit = FORM_UNIT_OF_SUFFIX[suffix] ?? suffix;
  if (!units.some(({ suffix: formSuffix }) => formSuffix === unit)) {
    throw new ConfigureFormEditError(`The form does not take ${value}. Use one of ${namesOf(units.map(({ suffix: formSuffix }) => formSuffix))}.`);
  }

  return { size: Number(amount), unit };
}

function namesOf(names: string[]): string {
  return names.filter(Boolean).join(", ") || "none";
}
