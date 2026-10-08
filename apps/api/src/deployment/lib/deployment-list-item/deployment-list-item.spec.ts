import { describe, expect, it } from "vitest";

import type { LeaseGpusByLease } from "@src/deployment/services/lease-gpu/lease-gpu.service";
import { toDeploymentListItem, withLeaseGpus } from "./deployment-list-item";

import { createDeploymentInfoGroupSeed, createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";

describe(toDeploymentListItem.name, () => {
  it("lists the deployment with its groups, escrow account and leases", () => {
    const groups = [createDeploymentInfoGroupSeed({ dseq: "100" })];
    const deployment = createDeploymentInfoSeed({ dseq: "100", groups });
    const leases = [createLeaseApiResponse({ dseq: "100" }).lease];

    const item = toDeploymentListItem({ deployment, leases, setting: undefined, leaseGpus: undefined });

    expect(item).toEqual({
      deployment: deployment.deployment,
      groups,
      leases,
      escrow_account: deployment.escrow_account,
      name: null,
      settings: null
    });
  });

  it("returns what the console holds about the deployment, with its runtime end as an ISO timestamp", () => {
    const setting = { name: "web", closed: true, runtimeLimitHours: 5, runtimeEndsAt: new Date("2026-09-20T10:00:00.000Z") };

    const item = toDeploymentListItem({ deployment: createDeploymentInfoSeed(), leases: [], setting, leaseGpus: undefined });

    expect(item.name).toBe("web");
    expect(item.settings).toEqual({ name: "web", closed: true, runtimeLimitHours: 5, runtimeEndsAt: "2026-09-20T10:00:00.000Z" });
  });

  it("returns no name and no runtime end for a deployment the console holds unnamed and unanchored", () => {
    const setting = { name: null, closed: false, runtimeLimitHours: null, runtimeEndsAt: null };

    const item = toDeploymentListItem({ deployment: createDeploymentInfoSeed(), leases: [], setting, leaseGpus: undefined });

    expect(item.name).toBeNull();
    expect(item.settings).toEqual({ name: null, closed: false, runtimeLimitHours: null, runtimeEndsAt: null });
  });

  it("attaches the gpus the console recorded to the lease they describe", () => {
    const lease = createLeaseApiResponse({ dseq: "100" }).lease;
    const offeredGpus = { gpus: [], recordedAt: "2026-09-21T09:00:00.000Z" };
    const leaseGpus: LeaseGpusByLease = new Map([[`${lease.id.gseq}/${lease.id.oseq}/${lease.id.provider}`, { offeredGpus }]]);

    const item = toDeploymentListItem({ deployment: createDeploymentInfoSeed({ dseq: "100" }), leases: [lease], setting: undefined, leaseGpus });

    expect(item.leases).toEqual([{ ...lease, offeredGpus }]);
  });
});

describe(withLeaseGpus.name, () => {
  it("leaves a lease the console recorded nothing for without either field at all", () => {
    const lease = createLeaseApiResponse().lease;
    const otherLease = createLeaseApiResponse().lease;
    const offeredGpus = { gpus: [], recordedAt: "2026-09-21T09:00:00.000Z" };

    const leases = withLeaseGpus([lease], new Map([[`${otherLease.id.gseq}/${otherLease.id.oseq}/${otherLease.id.provider}-other`, { offeredGpus }]]));

    expect(leases[0]).toEqual(lease);
    expect(leases[0]).not.toHaveProperty("offeredGpus");
    expect(leases[0]).not.toHaveProperty("detectedGpus");
  });

  it("hands back the leases as they were when the console recorded nothing for the deployment", () => {
    const leases = [createLeaseApiResponse().lease];

    expect(withLeaseGpus(leases, undefined)).toBe(leases);
    expect(withLeaseGpus(leases, new Map())).toBe(leases);
  });
});
