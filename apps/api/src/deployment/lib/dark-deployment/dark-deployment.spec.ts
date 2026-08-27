import { describe, expect, it } from "vitest";

import type { ActiveLeaseOnProvider } from "@src/deployment/repositories/lease/lease.repository";
import type { ProviderOutage } from "@src/deployment/services/provider-outages-http/provider-outages-http.service";
import { resolveFullyDarkDeployment } from "./dark-deployment";

const OWNER = "akash1owner";
const DSEQ = "1784768430632";
const DARK_PROVIDER = "akash1dark";
const DARKER_PROVIDER = "akash1darker";
const HEALTHY_PROVIDER = "akash1healthy";
const DOWN_SINCE = "2026-07-24T00:00:00.000Z";
const LONGER_OUTAGE_SINCE = "2026-07-01T00:00:00.000Z";

describe("resolveFullyDarkDeployment", () => {
  it("resolves a deployment whose only lease sits on an unreachable provider", () => {
    const result = resolveFullyDarkDeployment([aLease({})], outageMap([anOutage({})]));

    expect(result).toEqual({ owner: OWNER, dseq: DSEQ, hostUri: "https://dark:8443", downSince: DOWN_SINCE });
  });

  it("resolves nothing while one lease still sits on a provider that answers", () => {
    const result = resolveFullyDarkDeployment([aLease({}), aLease({ providerAddress: HEALTHY_PROVIDER })], outageMap([anOutage({})]));

    expect(result).toBeNull();
  });

  it("resolves nothing for a deployment with no active leases left", () => {
    const result = resolveFullyDarkDeployment([], outageMap([anOutage({})]));

    expect(result).toBeNull();
  });

  it("names the host down longest and pairs it with that same host's outage start", () => {
    const leases = [aLease({}), aLease({ providerAddress: DARKER_PROVIDER })];
    const outages = outageMap([anOutage({}), anOutage({ provider: DARKER_PROVIDER, hostUri: "https://darker:8443", startedAt: LONGER_OUTAGE_SINCE })]);

    const result = resolveFullyDarkDeployment(leases, outages);

    expect(result).toEqual({ owner: OWNER, dseq: DSEQ, hostUri: "https://darker:8443", downSince: LONGER_OUTAGE_SINCE });
  });

  it("names the host down longest regardless of the order the leases arrive in", () => {
    const leases = [aLease({ providerAddress: DARKER_PROVIDER }), aLease({})];
    const outages = outageMap([anOutage({}), anOutage({ provider: DARKER_PROVIDER, hostUri: "https://darker:8443", startedAt: LONGER_OUTAGE_SINCE })]);

    const result = resolveFullyDarkDeployment(leases, outages);

    expect(result?.hostUri).toBe("https://darker:8443");
    expect(result?.downSince).toBe(LONGER_OUTAGE_SINCE);
  });
});

function outageMap(outages: ProviderOutage[]): Map<string, ProviderOutage> {
  return new Map(outages.map(outage => [outage.provider, outage]));
}

function anOutage(overrides: Partial<ProviderOutage>): ProviderOutage {
  return {
    provider: overrides.provider ?? DARK_PROVIDER,
    hostUri: overrides.hostUri ?? "https://dark:8443",
    startedAt: overrides.startedAt ?? DOWN_SINCE
  };
}

function aLease(overrides: Partial<ActiveLeaseOnProvider>): ActiveLeaseOnProvider {
  return {
    owner: overrides.owner ?? OWNER,
    dseq: overrides.dseq ?? DSEQ,
    providerAddress: overrides.providerAddress ?? DARK_PROVIDER
  };
}
