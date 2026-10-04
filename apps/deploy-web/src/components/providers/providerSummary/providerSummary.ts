import type { ApiProviderList, ApiProviderLocation, StatsItem } from "@src/types/provider";
import { bytesToShrink } from "@src/utils/unitUtils";

export type ProviderCoordinates = { lat: number; lng: number };

export type ProviderSummary = {
  owner: string;
  name: string;
  hostUri: string;
  location: string | null;
  locationRegion: string | null;
  isAudited: boolean;
  isOnline: boolean;
  uptime30d: number | null;
  gpuCount: number;
  gpuModels: string[];
  vcpuCount: number;
  memoryBytes: number;
  storageBytes: number;
  coordinates: ProviderCoordinates | null;
};

export type UptimeQuality = "excellent" | "healthy" | "variable";

const EXCELLENT_UPTIME = 0.999;
const HEALTHY_UPTIME = 0.99;
const MILLICORES_PER_VCPU = 1000;

export function summarizeLocatedProvider(location: ApiProviderLocation): ProviderSummary {
  return {
    ...summarizeIdentity(location),
    isOnline: true,
    gpuModels: location.gpuModels,
    coordinates: parseCoordinates(location.ipLat, location.ipLon)
  };
}

export function summarizeListedProvider(provider: ApiProviderList): ProviderSummary {
  return {
    ...summarizeIdentity(provider),
    isOnline: provider.isOnline,
    gpuModels: [...new Set(provider.gpuModels.map(gpu => gpu.model))],
    coordinates: parseCoordinates(provider.ipLat, provider.ipLon)
  };
}

function summarizeIdentity(provider: ApiProviderLocation | ApiProviderList): Omit<ProviderSummary, "isOnline" | "gpuModels" | "coordinates"> {
  return {
    owner: provider.owner,
    name: getProviderName(provider),
    hostUri: provider.hostUri,
    location: formatProviderLocation(provider.ipRegion, provider.ipCountryCode),
    locationRegion: provider.locationRegion || null,
    isAudited: provider.isAudited,
    uptime30d: provider.uptime30d ?? null,
    gpuCount: totalOf(provider.stats.gpu),
    vcpuCount: Math.round(totalOf(provider.stats.cpu) / MILLICORES_PER_VCPU),
    memoryBytes: totalOf(provider.stats.memory),
    storageBytes: totalOf(provider.stats.storage.ephemeral) + totalOf(provider.stats.storage.persistent)
  };
}

export function getProviderName({ name, hostUri }: { name: string | null; hostUri: string }): string {
  if (name) return name;

  try {
    return new URL(hostUri).hostname;
  } catch {
    return hostUri;
  }
}

export function formatProviderLocation(region: string | null | undefined, countryCode: string | null | undefined): string | null {
  const parts = [region, countryCode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function parseCoordinates(lat: string | null | undefined, lng: string | null | undefined): ProviderCoordinates | null {
  if (!lat || !lng) return null;

  const coordinates = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng) ? coordinates : null;
}

export function totalOf(item: Pick<StatsItem, "active" | "available" | "pending">): number {
  return item.active + item.available + item.pending;
}

export function formatGpuModel(model: string): string {
  return model.toUpperCase();
}

export function formatUptime(uptime: number): string {
  return `${parseFloat((uptime * 100).toFixed(2))}%`;
}

export function formatOptionalUptime(uptime: number | null | undefined): string {
  return uptime === null || uptime === undefined ? "—" : formatUptime(uptime);
}

export function getUptimeQuality(uptime: number): UptimeQuality {
  if (uptime > EXCELLENT_UPTIME) return "excellent";
  if (uptime > HEALTHY_UPTIME) return "healthy";
  return "variable";
}

export function formatBytes(bytes: number): string {
  const { value, unit } = bytesToShrink(bytes);
  const rounded = value >= 10 ? Math.round(value) : parseFloat(value.toFixed(1));
  return `${rounded} ${unit}`;
}

export function formatCompactCount(count: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(count);
}
