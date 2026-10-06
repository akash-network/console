import type { ProviderStatus, ProviderStatusDto, ProviderVersion } from "@src/types/provider";

export function providerStatusToDto(providerStatus: ProviderStatus, providerVersion: ProviderVersion): ProviderStatusDto {
  return {
    name: providerStatus.cluster_public_hostname,
    orderCount: providerStatus.bidengine.orders,
    deploymentCount: providerStatus.manifest.deployments,
    leaseCount: providerStatus.cluster.leases,
    active: providerStatus.cluster.inventory.active,
    available: providerStatus.cluster.inventory.available,
    pending: providerStatus.cluster.inventory.pending,
    error: providerStatus.cluster.inventory.error,
    akash: providerVersion.akash,
    kube: providerVersion.kube
  };
}

export const getProviderNameFromUri = (uri: string) => {
  const name = new URL(uri).hostname;
  return name;
};

/**
 * Display name for a provider: its organization, else the host parsed from its URI, else its on-chain
 * address. The address fallback covers bid-sourced offers, which carry no screened host/organization —
 * `getProviderNameFromUri` would throw on their empty `hostUri`.
 */
export const providerDisplayName = (provider: { organization?: string | null; hostUri?: string | null; owner: string }): string => {
  const organization = provider.organization?.trim();
  if (organization) return organization;

  const hostUri = provider.hostUri?.trim();
  if (!hostUri) return provider.owner;

  try {
    return getProviderNameFromUri(hostUri);
  } catch {
    return provider.owner;
  }
};

export function formatProviderCount(count: number | undefined): string | undefined {
  if (count === undefined) return undefined;
  return `${count} ${count === 1 ? "provider" : "providers"}`;
}

export function describeGpuAvailability(providerCount: number, gpuCount: number | null): string {
  const providers = `${providerCount} ${providerCount === 1 ? "provider" : "providers"}`;
  return gpuCount === null ? providers : `${gpuCount} free ${gpuCount === 1 ? "GPU" : "GPUs"} on ${providers}`;
}
