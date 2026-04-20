import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";

export type PlacementFilters = {
  maxPrice: number | null;
  auditedBy: string[];
  regions: string[];
};

type ResourceUnit = {
  cpu: number;
  memory: number;
  gpu: number;
  gpuAttributes?: { vendor: string; model?: string; interface?: string; memorySize?: string };
  ephemeralStorage: number;
  persistentStorage?: number;
  persistentStorageClass?: "beta1" | "beta2" | "beta3";
  count: number;
};

type BidScreeningRequest = {
  data: {
    resources: ResourceUnit[];
    requirements: {
      attributes?: { key: string; value: string }[];
      signedBy?: { allOf?: string[]; anyOf?: string[] };
    };
    limit: number;
  };
};

const UNIT_MULTIPLIERS: Record<string, number> = {
  mi: 1048576,
  mb: 1000000,
  gi: 1073741824,
  gb: 1000000000,
  ti: 1099511627776,
  tb: 1000000000000
};

function toBytes(size: number, unit: string): number {
  const multiplier = UNIT_MULTIPLIERS[unit.toLowerCase()] ?? 1;
  return Math.round(size * multiplier);
}

function serviceToResourceUnit(service: ServiceType): ResourceUnit {
  const { profile, count } = service;
  const ephemeralStorage = profile.storage.find(s => !s.isPersistent);
  const persistentStorage = profile.storage.find(s => s.isPersistent);

  const unit: ResourceUnit = {
    cpu: Math.round(profile.cpu * 1000),
    memory: toBytes(profile.ram, profile.ramUnit),
    gpu: profile.hasGpu ? profile.gpu ?? 0 : 0,
    ephemeralStorage: ephemeralStorage ? toBytes(ephemeralStorage.size, ephemeralStorage.unit) : toBytes(1, "Gi"),
    count: count ?? 1
  };

  if (unit.gpu > 0 && profile.gpuModels?.length) {
    const model = profile.gpuModels[0];
    unit.gpuAttributes = {
      vendor: model.vendor,
      ...(model.name && { model: model.name }),
      ...(model.interface && { interface: model.interface }),
      ...(model.memory && { memorySize: model.memory })
    };
  }

  if (persistentStorage) {
    unit.persistentStorage = toBytes(persistentStorage.size, persistentStorage.unit);
    if (persistentStorage.type && ["beta1", "beta2", "beta3"].includes(persistentStorage.type)) {
      unit.persistentStorageClass = persistentStorage.type as "beta1" | "beta2" | "beta3";
    }
  }

  return unit;
}

export function sdlFormToBidScreeningRequest(formValues: SdlBuilderFormValuesType, placementFilters: PlacementFilters): BidScreeningRequest {
  const resources = formValues.services.map(serviceToResourceUnit);

  const requirements: BidScreeningRequest["data"]["requirements"] = {};

  const firstService = formValues.services[0];
  if (firstService?.placement?.attributes?.length) {
    requirements.attributes = firstService.placement.attributes.map(attr => ({
      key: attr.key ?? "",
      value: attr.value ?? ""
    }));
  }

  const hasAuditedBy = placementFilters.auditedBy.length > 0;
  const hasSignedByAllOf = (firstService?.placement?.signedBy?.allOf?.length ?? 0) > 0;
  const hasSignedByAnyOf = (firstService?.placement?.signedBy?.anyOf?.length ?? 0) > 0;

  if (hasAuditedBy || hasSignedByAllOf || hasSignedByAnyOf) {
    requirements.signedBy = {};
    const anyOf = [...(firstService?.placement?.signedBy?.anyOf?.map(s => s.value) ?? []), ...placementFilters.auditedBy];
    if (anyOf.length > 0) requirements.signedBy.anyOf = anyOf;
    const allOf = firstService?.placement?.signedBy?.allOf?.map(s => s.value) ?? [];
    if (allOf.length > 0) requirements.signedBy.allOf = allOf;
  }

  return {
    data: {
      resources,
      requirements,
      limit: 200
    }
  };
}
