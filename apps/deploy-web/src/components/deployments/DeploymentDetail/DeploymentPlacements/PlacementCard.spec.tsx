import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseServiceStatus, LeaseStatusDto } from "@src/queries/useLeaseQuery";
import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, PlacementCard } from "./PlacementCard";
import type { ManifestServiceDetail } from "./placementModel";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(PlacementCard.name, () => {
  it("renders the placement name, provider region and provider name", () => {
    setup({
      lease: buildLease({ groupName: "dcloud" }),
      provider: buildProvider({ region: "us-east" })
    });

    expect(screen.getByRole("heading", { name: "dcloud" })).toBeInTheDocument();
    expect(screen.getByText("us-east")).toBeInTheDocument();
    expect(screen.getByText("Meridian Cloud")).toBeInTheDocument();
  });

  it("hides the region when the provider has not declared one", () => {
    setup({ provider: buildProvider() });

    expect(screen.getByText("Meridian Cloud")).toBeInTheDocument();
    expect(screen.queryByText("us-east")).not.toBeInTheDocument();
  });

  it("renders one service row per live service reported by the lease status", () => {
    const PlacementServiceRow = vi.fn(() => <div>service-row</div>);
    setup({ leaseStatus: buildStatus(["web", "api"]), dependencies: { PlacementServiceRow } });

    expect(PlacementServiceRow).toHaveBeenCalledTimes(2);
  });

  it("falls back to manifest services when no live status is available", () => {
    const PlacementServiceRow = vi.fn(() => <div>service-row</div>);
    setup({ leaseStatus: null, manifestServices: { web: {}, worker: {} }, dependencies: { PlacementServiceRow } });

    expect(PlacementServiceRow).toHaveBeenCalledTimes(2);
  });

  it("scopes the fallback to the placement's own services when the manifest lists more than one placement", () => {
    const PlacementServiceRow = vi.fn(() => <div>service-row</div>);
    setup({
      leaseStatus: null,
      manifestServices: { web: {}, worker: {}, api: {} },
      placementServices: { web: {}, worker: {} },
      dependencies: { PlacementServiceRow }
    });

    expect(PlacementServiceRow).toHaveBeenCalledTimes(2);
  });

  it("shows the reclamation card when the lease has been reclaimed", () => {
    const ReclamationCard = vi.fn(() => <div>reclamation</div>);
    setup({ lease: buildLease({ state: "closed", groupState: "paused" }), leaseStatus: null, dependencies: { ReclamationCard } });

    expect(screen.getByText("reclamation")).toBeInTheDocument();
  });

  function buildLease(input?: { groupName?: string; state?: string; groupState?: string }) {
    return mock<LeaseDto>({
      id: "1",
      provider: "akash1p",
      state: input?.state ?? "active",
      cpuAmount: 6,
      gpuAmount: 0,
      memoryAmount: 1_000_000,
      storageAmount: 2_000_000,
      group: mock<DeploymentGroup>({
        state: input?.groupState ?? "active",
        group_spec: {
          name: input?.groupName ?? "dcloud",
          requirements: { attributes: [] as { key: string; value: string }[] },
          resources: [] as DeploymentGroup["group_spec"]["resources"]
        }
      } as Partial<DeploymentGroup>)
    });
  }

  function buildStatus(serviceNames: string[]) {
    return mock<LeaseStatusDto>({
      services: Object.fromEntries(serviceNames.map(name => [name, mock<LeaseServiceStatus>({ name, available: 1 })])),
      forwarded_ports: {},
      ips: {}
    });
  }

  function buildProvider(input?: { region?: string }) {
    return mock<ApiProviderList>({
      owner: "akash1p",
      organization: "Meridian Cloud",
      locationRegion: "",
      attributes: input?.region ? [{ key: "region", value: input.region, auditedBy: [] }] : []
    });
  }

  function setup(input?: {
    lease?: LeaseDto;
    provider?: ApiProviderList;
    leaseStatus?: LeaseStatusDto | null;
    manifestServices?: Record<string, ManifestServiceDetail>;
    placementServices?: Record<string, ManifestServiceDetail>;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const leaseStatus = input && "leaseStatus" in input ? input.leaseStatus : buildStatus(["web"]);
    const useLeaseStatus: typeof DEPENDENCIES.useLeaseStatus = () => mock<ReturnType<typeof DEPENDENCIES.useLeaseStatus>>({ data: leaseStatus });
    const useTeeResourceCarveouts: typeof DEPENDENCIES.useTeeResourceCarveouts = () => [];

    return render(
      <PlacementCard
        index={0}
        lease={input?.lease ?? buildLease()}
        provider={input?.provider ?? buildProvider()}
        manifestServices={input?.manifestServices ?? {}}
        placementServices={input?.placementServices}
        dseq="123"
        onClosed={vi.fn()}
        dependencies={MockComponents(DEPENDENCIES, { useLeaseStatus, useTeeResourceCarveouts, ...input?.dependencies })}
      />
    );
  }
});
