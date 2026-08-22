import yaml from "js-yaml";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, DeploymentPlacements } from "./DeploymentPlacements";
import type { PlacementCardProps } from "./PlacementCard";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(DeploymentPlacements.name, () => {
  it("shows an empty state when there are no leases", () => {
    setup({ leases: [] });

    expect(screen.getByText(/doesn't have any active placements/i)).toBeInTheDocument();
  });

  it("renders one placement card per lease", () => {
    const PlacementCard = vi.fn(() => <div>placement-card</div>);
    setup({ leases: [buildLease("a"), buildLease("b")], dependencies: { PlacementCard } });

    expect(PlacementCard).toHaveBeenCalledTimes(2);
  });

  it("passes the provider matched by lease owner to each card", () => {
    const PlacementCard = vi.fn((_props: PlacementCardProps) => <div>placement-card</div>);
    const providers = [mock<ApiProviderList>({ owner: "akash1prov" })];
    setup({ leases: [buildLease("a", "akash1prov")], providers, dependencies: { PlacementCard } });

    expect(PlacementCard.mock.calls[0][0]).toEqual(expect.objectContaining({ provider: providers[0] }));
  });

  it("summarizes placement and service counts from the manifest", () => {
    const manifest = yaml.dump({ services: { web: {}, api: {}, worker: {} } });
    setup({ leases: [buildLease("a"), buildLease("b")], deploymentManifest: manifest });

    expect(screen.getByRole("heading", { name: "Placements" })).toBeInTheDocument();
    expect(screen.getByText("2 placements · 3 services")).toBeInTheDocument();
  });

  it("falls back to the lease count for services when the manifest is unavailable", () => {
    setup({ leases: [buildLease("a"), buildLease("b")], deploymentManifest: "" });

    expect(screen.getByText("2 placements · 2 services")).toBeInTheDocument();
  });

  it("counts only the services in placements that actually have a lease", () => {
    const manifest = yaml.dump({
      services: { web: {}, api: {}, worker: {} },
      deployment: { web: { dcloud: {} }, api: { dcloud: {} }, worker: { other: {} } }
    });
    setup({ leases: [buildLeaseInPlacement("a", "dcloud")], deploymentManifest: manifest });

    expect(screen.getByText("1 placement · 2 services")).toBeInTheDocument();
  });

  function buildLease(id: string, provider = "akash1prov") {
    return mock<LeaseDto>({ id, provider });
  }

  function buildLeaseInPlacement(id: string, placementName: string) {
    return mock<LeaseDto>({ id, provider: "akash1prov", group: mock<DeploymentGroup>({ group_spec: { name: placementName } } as Partial<DeploymentGroup>) });
  }

  function setup(input: { leases: LeaseDto[]; providers?: ApiProviderList[]; deploymentManifest?: string; dependencies?: Partial<typeof DEPENDENCIES> }) {
    return render(
      <DeploymentPlacements
        leases={input.leases}
        providers={input.providers ?? []}
        deploymentManifest={input.deploymentManifest ?? ""}
        dseq="123"
        onClosed={vi.fn()}
        dependencies={MockComponents(DEPENDENCIES, input.dependencies)}
      />
    );
  }
});
