import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ForwardedPort, LeaseServiceStatus, LeaseStatusDto } from "@src/queries/useLeaseQuery";
import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, PlacementCard } from "./PlacementCard";
import type { ManifestServiceDetail } from "./placementModel";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(PlacementCard.name, () => {
  it("renders the placement name, provider region and provider name", () => {
    setup({
      lease: buildLease({ groupName: "dcloud" }),
      provider: buildProvider({ region: "us-east" })
    });

    expect(screen.getByRole("heading", { name: "dcloud" })).toBeInTheDocument();
    expect(screen.getByLabelText("Placement 1")).toBeInTheDocument();
    expect(screen.getByText("us-east")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Meridian Cloud/ })).toHaveAttribute("href", expect.stringContaining("/providers/akash1p"));
  });

  it("omits the GPU stat when the lease requests no GPU", () => {
    setup();

    expect(screen.getByText("vCPU")).toBeInTheDocument();
    expect(screen.queryByText("GPU")).not.toBeInTheDocument();
  });

  it("shows the GPU stat when the lease requests a GPU", () => {
    setup({ lease: buildLease({ gpuAmount: 1 }) });

    expect(screen.getByText("GPU")).toBeInTheDocument();
  });

  it("shows the gpu count and model when the lease declares one", () => {
    setup({
      lease: buildLease({
        gpuAmount: 1,
        gpuAttributes: [{ key: "vendor/nvidia/model/h100", value: "true" }]
      })
    });

    expect(screen.getByText("H100")).toBeInTheDocument();
  });

  it("expands every service when Expand all is clicked", async () => {
    setup({
      leaseStatus: buildStatus(["web", "api"], {
        web: [{ host: "provider.io", externalPort: 30000, port: 80, available: 1 }],
        api: [{ host: "provider.io", externalPort: 30001, port: 8080, available: 1 }]
      }),
      dependencies: { PlacementServiceRow: DEPENDENCIES.PlacementServiceRow }
    });

    expect(screen.queryByText("Ports")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /expand all/i }));

    expect(screen.getAllByText("Ports")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /collapse all/i })).toBeInTheDocument();
  });

  it("hides the region when the provider has not declared one", () => {
    setup({ provider: buildProvider() });

    expect(screen.getByRole("link", { name: /Meridian Cloud/ })).toBeInTheDocument();
    expect(screen.queryByText("us-east")).not.toBeInTheDocument();
  });

  it("hides expand all when the lease is closed", () => {
    setup({ lease: buildLease({ state: "closed" }), leaseStatus: null });

    expect(screen.queryByRole("button", { name: /expand all/i })).not.toBeInTheDocument();
  });

  it("hides expand all when the lease has been reclaimed while still active", () => {
    setup({ lease: buildLease({ groupState: "paused" }) });

    expect(screen.queryByRole("button", { name: /expand all/i })).not.toBeInTheDocument();
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

  it("shows the reclamation card and no reclaiming badge when the lease has been reclaimed", () => {
    const ReclamationCard = vi.fn(() => <div>reclamation</div>);
    setup({ lease: buildLease({ state: "closed", groupState: "paused" }), leaseStatus: null, dependencies: { ReclamationCard } });

    expect(screen.getByText("reclamation")).toBeInTheDocument();
    expect(screen.queryByText("Reclaiming")).not.toBeInTheDocument();
  });

  it("shows a reclaiming status while the lease is in the reclamation grace period", () => {
    setup({ lease: buildLease({ state: "reclaiming" }) });

    expect(screen.getByText("Reclaiming")).toBeInTheDocument();
  });

  it("does not show a reclaiming status for an active lease", () => {
    setup();

    expect(screen.queryByText("Reclaiming")).not.toBeInTheDocument();
  });

  function buildLease(input?: {
    groupName?: string;
    state?: string;
    groupState?: string;
    gpuAmount?: number;
    gpuAttributes?: { key: string; value: string }[];
  }) {
    return mock<LeaseDto>({
      id: "1",
      provider: "akash1p",
      state: input?.state ?? "active",
      cpuAmount: 6,
      gpuAmount: input?.gpuAmount ?? 0,
      memoryAmount: 1_000_000,
      storageAmount: 2_000_000,
      group: mock<DeploymentGroup>({
        state: input?.groupState ?? "active",
        group_spec: {
          name: input?.groupName ?? "dcloud",
          requirements: { attributes: [] as { key: string; value: string }[] },
          resources: input?.gpuAttributes ? [{ resource: { gpu: { attributes: input.gpuAttributes } } }] : ([] as DeploymentGroup["group_spec"]["resources"])
        }
      } as Partial<DeploymentGroup>)
    });
  }

  function buildStatus(serviceNames: string[], forwardedPorts: Record<string, ForwardedPort[]> = {}) {
    return mock<LeaseStatusDto>({
      services: Object.fromEntries(serviceNames.map(name => [name, mock<LeaseServiceStatus>({ name, available: 1, uris: [] })])),
      forwarded_ports: forwardedPorts,
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
      <TooltipProvider>
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
      </TooltipProvider>
    );
  }
});
