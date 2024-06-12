import { Provider, ProviderSnapshot, ProviderSnapshotNode } from "@akashnetwork/database/dbSchemas/akash";
import semver from "semver";

import { Auditor, ProviderAttributesSchema, ProviderList } from "@src/types/provider";
import { createFilterUnique } from "../array/array";

export const mapProviderToList = (
  provider: Provider,
  providerAttributeSchema: ProviderAttributesSchema,
  auditors: Array<Auditor>,
  lastSuccessfulSnapshot?: ProviderSnapshot
): ProviderList => {
  const isValidVersion = provider.cosmosSdkVersion ? semver.gte(provider.cosmosSdkVersion, "v0.45.9") : false;
  const name = provider.isOnline ? new URL(provider.hostUri).hostname : null;
  const gpuModels = getDistinctGpuModelsFromNodes(lastSuccessfulSnapshot?.nodes || []);

  return {
    owner: provider.owner,
    name: name,
    hostUri: provider.hostUri,
    createdHeight: provider.createdHeight,
    email: provider.email || getProviderAttributeValue("email", provider, providerAttributeSchema),
    website: provider.website || getProviderAttributeValue("website", provider, providerAttributeSchema),
    lastCheckDate: provider.lastCheckDate,
    deploymentCount: provider.deploymentCount,
    leaseCount: provider.leaseCount,
    cosmosSdkVersion: provider.cosmosSdkVersion,
    akashVersion: provider.akashVersion,
    ipRegion: provider.ipRegion,
    ipRegionCode: provider.ipRegionCode,
    ipCountry: provider.ipCountry,
    ipCountryCode: provider.ipCountryCode,
    ipLat: provider.ipLat,
    ipLon: provider.ipLon,
    activeStats: {
      cpu: provider.activeCPU,
      gpu: provider.activeGPU,
      memory: provider.activeMemory,
      storage: provider.activeStorage
    },
    pendingStats: {
      cpu: isValidVersion ? provider.pendingCPU : 0,
      gpu: isValidVersion ? provider.pendingGPU : 0,
      memory: isValidVersion ? provider.pendingMemory : 0,
      storage: isValidVersion ? provider.pendingStorage : 0
    },
    availableStats: {
      cpu: isValidVersion ? provider.availableCPU : 0,
      gpu: isValidVersion ? provider.availableGPU : 0,
      memory: isValidVersion ? provider.availableMemory : 0,
      storage: isValidVersion ? provider.availableStorage : 0
    },
    gpuModels: gpuModels,
    uptime1d: provider.uptime1d,
    uptime7d: provider.uptime7d,
    uptime30d: provider.uptime30d,
    isValidVersion,
    isOnline: provider.isOnline,
    lastOnlineDate: lastSuccessfulSnapshot?.checkDate,
    isAudited: provider.providerAttributeSignatures.some(a => auditors.some(y => y.address === a.auditor)),
    attributes: provider.providerAttributes.map(attr => ({
      key: attr.key,
      value: attr.value,
      auditedBy: provider.providerAttributeSignatures.filter(pas => pas.key === attr.key && pas.value === attr.value).map(pas => pas.auditor)
    })),

    // Attributes schema
    host: getProviderAttributeValue("host", provider, providerAttributeSchema),
    organization: getProviderAttributeValue("organization", provider, providerAttributeSchema),
    statusPage: getProviderAttributeValue("status-page", provider, providerAttributeSchema),
    locationRegion: getProviderAttributeValue("location-region", provider, providerAttributeSchema),
    country: getProviderAttributeValue("country", provider, providerAttributeSchema),
    city: getProviderAttributeValue("city", provider, providerAttributeSchema),
    timezone: getProviderAttributeValue("timezone", provider, providerAttributeSchema),
    locationType: getProviderAttributeValue("location-type", provider, providerAttributeSchema),
    hostingProvider: getProviderAttributeValue("hosting-provider", provider, providerAttributeSchema),
    hardwareCpu: getProviderAttributeValue("hardware-cpu", provider, providerAttributeSchema),
    hardwareCpuArch: getProviderAttributeValue("hardware-cpu-arch", provider, providerAttributeSchema),
    hardwareGpuVendor: getProviderAttributeValue("hardware-gpu", provider, providerAttributeSchema),
    hardwareGpuModels: getProviderAttributeValue("hardware-gpu-model", provider, providerAttributeSchema),
    hardwareDisk: getProviderAttributeValue("hardware-disk", provider, providerAttributeSchema),
    featPersistentStorage: getProviderAttributeValue("feat-persistent-storage", provider, providerAttributeSchema),
    featPersistentStorageType: getProviderAttributeValue("feat-persistent-storage-type", provider, providerAttributeSchema),
    hardwareMemory: getProviderAttributeValue("hardware-memory", provider, providerAttributeSchema),
    networkProvider: getProviderAttributeValue("network-provider", provider, providerAttributeSchema),
    networkSpeedDown: getProviderAttributeValue("network-speed-down", provider, providerAttributeSchema),
    networkSpeedUp: getProviderAttributeValue("network-speed-up", provider, providerAttributeSchema),
    tier: getProviderAttributeValue("tier", provider, providerAttributeSchema),
    featEndpointCustomDomain: getProviderAttributeValue("feat-endpoint-custom-domain", provider, providerAttributeSchema),
    workloadSupportChia: getProviderAttributeValue("workload-support-chia", provider, providerAttributeSchema),
    workloadSupportChiaCapabilities: getProviderAttributeValue("workload-support-chia-capabilities", provider, providerAttributeSchema),
    featEndpointIp: getProviderAttributeValue("feat-endpoint-ip", provider, providerAttributeSchema)
  } as ProviderList;
};

function getDistinctGpuModelsFromNodes(nodes: ProviderSnapshotNode[]) {
  const gpuModels = nodes.flatMap(x => x.gpus).map(x => ({ vendor: x.vendor, model: x.name, ram: x.memorySize, interface: x.interface }));
  const distinctGpuModels = gpuModels.filter(
    createFilterUnique((a, b) => a.vendor === b.vendor && a.model === b.model && a.ram === b.ram && a.interface === b.interface)
  );

  return distinctGpuModels;
}

export const getProviderAttributeValue = (
  key: keyof ProviderAttributesSchema,
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
        .filter(x => x);
    case "multiple-option":
      return possibleValues
        .filter(x => provider.providerAttributes.some(at => at.key === x.key))
        .map(x => x.description)
        .filter(x => x);
    default:
      console.error(`Unknown attribute type: ${providerAttributeSchema[key].type}`);
      return null;
  }
};
