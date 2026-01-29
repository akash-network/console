import type { Provider, ProviderSnapshot, ProviderSnapshotNode } from "@akashnetwork/database/dbSchemas/akash";
import type { Auditor, ProviderAttributesSchema } from "@akashnetwork/http-sdk";
import semver from "semver";

import type { ProviderList, StatsItem } from "@src/types/provider";
import { createFilterUnique } from "../array/array";

export const mapProviderToList = (
  provider: Provider,
  providerAttributeSchema: ProviderAttributesSchema,
  auditors: Array<Auditor>,
  lastSuccessfulSnapshot?: ProviderSnapshot
): ProviderList => {
  const isValidSdkVersion = provider.cosmosSdkVersion ? semver.gte(provider.cosmosSdkVersion, "v0.45.9") : false;
  const name = provider.isOnline ? new URL(provider.hostUri).hostname : null;
  const gpuModels = getDistinctGpuModelsFromNodes(lastSuccessfulSnapshot?.nodes || []);
  const storage = {
    ephemeral: buildStatsItem("EphemeralStorage", lastSuccessfulSnapshot, isValidSdkVersion),
    persistent: buildStatsItem("PersistentStorage", lastSuccessfulSnapshot, isValidSdkVersion)
  };
  const stats: ProviderList["stats"] = {
    cpu: buildStatsItem("CPU", lastSuccessfulSnapshot, isValidSdkVersion),
    gpu: buildStatsItem("GPU", lastSuccessfulSnapshot, isValidSdkVersion),
    memory: buildStatsItem("Memory", lastSuccessfulSnapshot, isValidSdkVersion),
    storage: {
      ...storage,
      total: {
        active: storage.ephemeral.active + storage.persistent.active,
        available: storage.ephemeral.available + storage.persistent.available,
        pending: storage.ephemeral.pending + storage.persistent.pending,
        total: storage.ephemeral.total + storage.persistent.total
      }
    }
  };

  return {
    owner: provider.owner,
    name: name,
    hostUri: provider.hostUri,
    createdHeight: provider.createdHeight,
    email: provider.email || getStringAttribute("email", provider, providerAttributeSchema),
    website: provider.website || getStringAttribute("website", provider, providerAttributeSchema),
    lastCheckDate: provider.lastCheckDate || null,
    deploymentCount: lastSuccessfulSnapshot?.deploymentCount,
    leaseCount: lastSuccessfulSnapshot?.leaseCount,
    cosmosSdkVersion: provider.cosmosSdkVersion!,
    akashVersion: provider.akashVersion!,
    ipRegion: provider.ipRegion || null,
    ipRegionCode: provider.ipRegionCode || null,
    ipCountry: provider.ipCountry || null,
    ipCountryCode: provider.ipCountryCode || null,
    ipLat: provider.ipLat || null,
    ipLon: provider.ipLon || null,
    stats,
    gpuModels: gpuModels,
    uptime1d: provider.uptime1d || null,
    uptime7d: provider.uptime7d || null,
    uptime30d: provider.uptime30d || null,
    isValidVersion: isValidSdkVersion,
    isOnline: !!provider.isOnline,
    lastOnlineDate: lastSuccessfulSnapshot?.checkDate || null,
    isAudited: provider.providerAttributeSignatures.some(a => auditors.some(y => y.address === a.auditor)),
    attributes: provider.providerAttributes.map(attr => ({
      key: attr.key,
      value: attr.value,
      auditedBy: provider.providerAttributeSignatures.filter(pas => pas.key === attr.key && pas.value === attr.value).map(pas => pas.auditor)
    })),

    // Attributes schema
    host: getStringAttribute("host", provider, providerAttributeSchema),
    organization: getStringAttribute("organization", provider, providerAttributeSchema),
    statusPage: getStringAttribute("status-page", provider, providerAttributeSchema),
    locationRegion: getStringAttribute("location-region", provider, providerAttributeSchema),
    country: getStringAttribute("country", provider, providerAttributeSchema),
    city: getStringAttribute("city", provider, providerAttributeSchema),
    timezone: getStringAttribute("timezone", provider, providerAttributeSchema),
    locationType: getStringAttribute("location-type", provider, providerAttributeSchema),
    hostingProvider: getStringAttribute("hosting-provider", provider, providerAttributeSchema),
    hardwareCpu: getStringAttribute("hardware-cpu", provider, providerAttributeSchema),
    hardwareCpuArch: getStringAttribute("hardware-cpu-arch", provider, providerAttributeSchema),
    hardwareGpuVendor: getStringAttribute("hardware-gpu", provider, providerAttributeSchema),
    hardwareGpuModels: getStringArrayAttribute("hardware-gpu-model", provider, providerAttributeSchema),
    hardwareDisk: getStringArrayAttribute("hardware-disk", provider, providerAttributeSchema),
    featPersistentStorage: getBooleanAttribute("feat-persistent-storage", provider, providerAttributeSchema),
    featPersistentStorageType: getStringArrayAttribute("feat-persistent-storage-type", provider, providerAttributeSchema),
    hardwareMemory: getStringAttribute("hardware-memory", provider, providerAttributeSchema),
    networkProvider: getStringAttribute("network-provider", provider, providerAttributeSchema),
    networkSpeedDown: getNumberAttribute("network-speed-down", provider, providerAttributeSchema),
    networkSpeedUp: getNumberAttribute("network-speed-up", provider, providerAttributeSchema),
    tier: getStringAttribute("tier", provider, providerAttributeSchema),
    featEndpointCustomDomain: getBooleanAttribute("feat-endpoint-custom-domain", provider, providerAttributeSchema),
    workloadSupportChia: getBooleanAttribute("workload-support-chia", provider, providerAttributeSchema),
    workloadSupportChiaCapabilities: getStringArrayAttribute("workload-support-chia-capabilities", provider, providerAttributeSchema),
    featEndpointIp: getBooleanAttribute("feat-endpoint-ip", provider, providerAttributeSchema)
  };
};

type StatsEntry = "CPU" | "GPU" | "Memory" | "PersistentStorage" | "EphemeralStorage";
function buildStatsItem<T extends StatsEntry>(suffix: T, snapshot: ProviderSnapshot | undefined | null, isValidSdkVersion: boolean): StatsItem {
  if (!isValidSdkVersion) {
    return {
      active: snapshot?.[`active${suffix}`] || 0,
      available: 0,
      pending: 0,
      total: 0
    };
  }

  const item: StatsItem = {
    active: snapshot?.[`active${suffix}`] || 0,
    available: snapshot?.[`available${suffix}`] || 0,
    pending: snapshot?.[`pending${suffix}`] || 0,
    total: 0
  };

  item.total = item.active + item.available + item.pending;

  return item;
}

function getDistinctGpuModelsFromNodes(nodes: ProviderSnapshotNode[]) {
  const gpuModels = nodes.flatMap(x => x.gpus).map(x => ({ vendor: x.vendor, model: x.name, ram: x.memorySize, interface: x.interface }));
  const distinctGpuModels = gpuModels.filter(
    createFilterUnique((a, b) => a.vendor === b.vendor && a.model === b.model && a.ram === b.ram && a.interface === b.interface)
  );

  return distinctGpuModels;
}

export const getProviderAttributeValue = <TKey extends keyof ProviderAttributesSchema>(
  key: TKey,
  provider: Provider,
  providerAttributeSchema: ProviderAttributesSchema
): string | string[] | boolean | number | null => {
  const _key = providerAttributeSchema[key].key;
  const possibleValues = providerAttributeSchema[key].values;
  let values = null;

  switch (providerAttributeSchema[key].type) {
    case "string":
      return (
        provider.providerAttributes
          .filter(x => x.key === _key)
          .map(x => x.value)
          .join(",") || null
      );
    case "number":
      values =
        provider.providerAttributes
          .filter(x => x.key === _key)
          .map(x => x.value)
          .join(",") || "0";
      return parseFloat(values);
    case "boolean":
      values =
        provider.providerAttributes
          .filter(x => x.key === _key)
          .map(x => x.value)
          .join(",") || null;
      return values ? values === "true" : false;
    case "option":
      return provider.providerAttributes
        .filter(x => x.key === _key)
        .map(x => possibleValues?.find(v => v.key === x.value)?.description)
        .filter((x): x is string => !!x);
    case "multiple-option":
      if (!possibleValues) return null;
      return possibleValues
        .filter(x => provider.providerAttributes.some(at => at.key === x.key))
        .map(x => x.description)
        .filter((x): x is string => !!x);
    default:
      console.error(`Unknown attribute type: ${providerAttributeSchema[key].type}`);
      return null;
  }
};

function getStringAttribute(key: keyof ProviderAttributesSchema, provider: Provider, schema: ProviderAttributesSchema): string | null {
  const value = getProviderAttributeValue(key, provider, schema);
  return typeof value === "string" ? value : null;
}

function getStringArrayAttribute(key: keyof ProviderAttributesSchema, provider: Provider, schema: ProviderAttributesSchema): string[] | null {
  const value = getProviderAttributeValue(key, provider, schema);
  return Array.isArray(value) ? value : null;
}

function getBooleanAttribute(key: keyof ProviderAttributesSchema, provider: Provider, schema: ProviderAttributesSchema): boolean {
  const value = getProviderAttributeValue(key, provider, schema);
  return typeof value === "boolean" ? value : false;
}

function getNumberAttribute(key: keyof ProviderAttributesSchema, provider: Provider, schema: ProviderAttributesSchema): number {
  const value = getProviderAttributeValue(key, provider, schema);
  return typeof value === "number" ? value : 0;
}
