import type { ActiveLeaseOnProvider } from "@src/deployment/repositories/lease/lease.repository";
import type { ProviderOutage } from "@src/deployment/services/provider-outages-http/provider-outages-http.service";

export interface DarkDeployment {
  owner: string;
  dseq: string;
  hostUri: string;
  downSince: string;
}

/** The host named is the one down longest, so the outage age reported beside it belongs to that same host. */
export function resolveFullyDarkDeployment(leases: ActiveLeaseOnProvider[], outageByProvider: Map<string, ProviderOutage>): DarkDeployment | null {
  if (leases.length === 0) return null;

  const outages: ProviderOutage[] = [];

  for (const lease of leases) {
    const outage = outageByProvider.get(lease.providerAddress);
    if (!outage) return null;
    outages.push(outage);
  }

  const [{ owner, dseq }] = leases;
  const longestOutage = outages.reduce((longest, outage) => (outage.startedAt < longest.startedAt ? outage : longest));

  return { owner, dseq, hostUri: longestOutage.hostUri, downSince: longestOutage.startedAt };
}
