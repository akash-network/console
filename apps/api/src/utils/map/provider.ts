import type { Provider, ProviderSnapshot, ProviderSnapshotNode } from "@akashnetwork/database/dbSchemas/akash";
import type { ProviderAttributesSchema } from "@akashnetwork/http-sdk";
import semver from "semver";

import type { Auditor } from "@src/provider/http-schemas/auditor.schema";
import type { ProviderList, StatsItem } from "@src/types/provider";

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

  // Fix 5: Build auditor Set once for O(1) lookup instead of O(a×b) nested .some()
  const auditorSet = new Set(auditors.map(a => a.address));

  // Fix 2: Pre-index attribute signatures for O(1) lookup instead of O(m²) filtering
  const signatureIndex = new Map<string, string[]>();
  for (const sig of provider.providerAttributeSignatures) {
    const key = `${sig.key}|${sig.value}`;
    if (!signatureIndex.has(key)) {
      signatureIndex.set(key, []);
    }
    signatureIndex.get(key)!.push(sig.auditor);
  }

  // Fix 3: Build attribute map once for O(1) lookups instead of 31 separate array scans
  const attrMap = buildAttributeMap(provider);

  return {
    owner: provider.owner,
    name: name,
    hostUri: provider.hostUri,
    createdHeight: provider.createdHeight,
    email: provider.email || attrMap.get(providerAttributeSchema["email"].key) || null,
    website: provider.website || attrMap.get(providerAttributeSchema["website"].key) || null,
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
    isAudited: provider.providerAttributeSignatures.some(a => auditorSet.has(a.auditor)),
    attributes: provider.providerAttributes.map(attr => ({
      key: attr.key,
      value: attr.value,
      auditedBy: signatureIndex.get(`${attr.key}|${attr.value}`) || []
    })),

    // Attributes schema - using optimized getters with pre-built attrMap
    host: getStringAttributeOptimized("host", attrMap, providerAttributeSchema),
    organization: getStringAttributeOptimized("organization", attrMap, providerAttributeSchema),
    statusPage: getStringAttributeOptimized("status-page", attrMap, providerAttributeSchema),
    locationRegion: getStringAttributeOptimized("location-region", attrMap, providerAttributeSchema),
    country: getStringAttributeOptimized("country", attrMap, providerAttributeSchema),
    city: getStringAttributeOptimized("city", attrMap, providerAttributeSchema),
    timezone: getStringAttributeOptimized("timezone", attrMap, providerAttributeSchema),
    locationType: getStringAttributeOptimized("location-type", attrMap, providerAttributeSchema),
    hostingProvider: getStringAttributeOptimized("hosting-provider", attrMap, providerAttributeSchema),
    hardwareCpu: getStringAttributeOptimized("hardware-cpu", attrMap, providerAttributeSchema),
    hardwareCpuArch: getStringAttributeOptimized("hardware-cpu-arch", attrMap, providerAttributeSchema),
    hardwareGpuVendor: getStringAttributeOptimized("hardware-gpu", attrMap, providerAttributeSchema),
    hardwareGpuModels: getStringArrayAttribute("hardware-gpu-model", provider, providerAttributeSchema),
    hardwareDisk: getStringArrayAttribute("hardware-disk", provider, providerAttributeSchema),
    featPersistentStorage: getBooleanAttributeOptimized("feat-persistent-storage", attrMap, providerAttributeSchema),
    featPersistentStorageType: getStringArrayAttribute("feat-persistent-storage-type", provider, providerAttributeSchema),
    hardwareMemory: getStringAttributeOptimized("hardware-memory", attrMap, providerAttributeSchema),
    networkProvider: getStringAttributeOptimized("network-provider", attrMap, providerAttributeSchema),
    networkSpeedDown: getNumberAttributeOptimized("network-speed-down", attrMap, providerAttributeSchema),
    networkSpeedUp: getNumberAttributeOptimized("network-speed-up", attrMap, providerAttributeSchema),
    tier: getStringAttributeOptimized("tier", attrMap, providerAttributeSchema),
    featEndpointCustomDomain: getBooleanAttributeOptimized("feat-endpoint-custom-domain", attrMap, providerAttributeSchema),
    workloadSupportChia: getBooleanAttributeOptimized("workload-support-chia", attrMap, providerAttributeSchema),
    workloadSupportChiaCapabilities: getStringArrayAttribute("workload-support-chia-capabilities", provider, providerAttributeSchema),
    featEndpointIp: getBooleanAttributeOptimized("feat-endpoint-ip", attrMap, providerAttributeSchema)
  };
};

// Fix 3: Build attribute map once per provider for O(1) lookups
function buildAttributeMap(provider: Provider): Map<string, string> {
  const map = new Map<string, string>();
  for (const attr of provider.providerAttributes) {
    // For attributes with same key, join values with comma (matching original behavior)
    const existing = map.get(attr.key);
    if (existing) {
      map.set(attr.key, `${existing},${attr.value}`);
    } else {
      map.set(attr.key, attr.value);
    }
  }
  return map;
}

// Optimized attribute getters that use pre-built map for O(1) lookup
function getStringAttributeOptimized(key: keyof ProviderAttributesSchema, attrMap: Map<string, string>, schema: ProviderAttributesSchema): string | null {
  const schemaKey = schema[key].key;
  return attrMap.get(schemaKey) || null;
}

function getBooleanAttributeOptimized(key: keyof ProviderAttributesSchema, attrMap: Map<string, string>, schema: ProviderAttributesSchema): boolean {
  const schemaKey = schema[key].key;
  const value = attrMap.get(schemaKey);
  return value === "true";
}

function getNumberAttributeOptimized(key: keyof ProviderAttributesSchema, attrMap: Map<string, string>, schema: ProviderAttributesSchema): number {
  const schemaKey = schema[key].key;
  const value = attrMap.get(schemaKey);
  return value ? parseFloat(value) : 0;
}

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

// Fix 1: Set-based O(n) deduplication instead of O(n²) createFilterUnique
function getDistinctGpuModelsFromNodes(nodes: ProviderSnapshotNode[]) {
  const gpuModels = nodes
    .flatMap(x => x.gpus)
    .map(x => ({
      vendor: x.vendor,
      model: x.name,
      ram: x.memorySize,
      interface: x.interface
    }));

  const seen = new Set<string>();
  return gpuModels.filter(gpu => {
    const key = `${gpu.vendor}|${gpu.model}|${gpu.ram}|${gpu.interface}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function getStringArrayAttribute(key: keyof ProviderAttributesSchema, provider: Provider, schema: ProviderAttributesSchema): string[] | null {
  const value = getProviderAttributeValue(key, provider, schema);
  return Array.isArray(value) ? value : null;
}
