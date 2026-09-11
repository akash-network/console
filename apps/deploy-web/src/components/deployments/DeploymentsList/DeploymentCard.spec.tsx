import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto, NamedDeploymentDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentCard } from "./DeploymentCard";
import type { DeploymentReachability } from "./useDeploymentReachability";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentCard", () => {
  it("leads with the deployment name linked to its detail page", () => {
    setup({ deployment: { dseq: "100", name: "acme-storefront" } });

    expect(screen.getByRole("link", { name: "acme-storefront" })).toHaveAttribute("href", "/deployments/100");
  });

  it("falls back to the dseq when the deployment has no local name", () => {
    setup({ deployment: { dseq: "100", name: "" } });

    expect(screen.getByRole("link", { name: "Deployment #100" })).toBeInTheDocument();
  });

  it("resolves the status from the deployment state and its leases so the detail page cannot disagree", () => {
    const leases = [mock<LeaseDto>({ state: "active" })];
    const { DeploymentStatusBadge } = setup({ deployment: { dseq: "100" }, leases });

    expect(DeploymentStatusBadge).toHaveBeenCalledWith(expect.objectContaining({ state: "active", leases }), expect.anything());
  });

  it("passes the resolved reachability to the endpoints view", () => {
    const { DeploymentEndpoints } = setup({
      deployment: { dseq: "100" },
      reachability: { endpoints: [], isLoadingEndpoints: false, unreachableReason: "no-public-endpoint" }
    });

    expect(DeploymentEndpoints).toHaveBeenCalledWith(
      expect.objectContaining({ endpoints: [], isLoading: false, unreachableReason: "no-public-endpoint" }),
      expect.anything()
    );
  });

  it("summarises what the deployment uses", () => {
    const { DeploymentSpecSummary } = setup({ deployment: { dseq: "100" } });

    expect(DeploymentSpecSummary).toHaveBeenCalledWith(expect.objectContaining({ deployment: expect.objectContaining({ dseq: "100" }) }), expect.anything());
  });

  it("reports a shift-click so a range of cards can be selected at once", async () => {
    const { onSelect } = setup({ deployment: { dseq: "100", name: "acme" }, isSelectable: true });
    const user = userEvent.setup();

    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("checkbox", { name: "Select deployment acme" }));

    expect(onSelect).toHaveBeenCalledWith({ id: "100", isShiftPressed: true });
  });

  it("offers no selection when the collection cannot be acted on in bulk", () => {
    setup({ deployment: { dseq: "100" } });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  function setup(input: {
    deployment: Partial<NamedDeploymentDto> & { dseq: string };
    leases?: LeaseDto[];
    reachability?: Partial<DeploymentReachability>;
    isSelectable?: boolean;
  }) {
    const leases = input.leases ?? [];
    const useDeploymentReachability = vi.fn<typeof DEPENDENCIES.useDeploymentReachability>(() => ({
      leases,
      isLoadingLeases: false,
      endpoints: [],
      isLoadingEndpoints: false,
      unreachableReason: null,
      ...input.reachability
    }));

    const DeploymentStatusBadge = vi.fn(() => <div>status</div>);
    const DeploymentEndpoints = vi.fn(() => <div>endpoints</div>);
    const DeploymentSpecSummary = vi.fn(() => <div>specs</div>);
    const onSelect = vi.fn();
    const deployment = { state: "active", cpuAmount: 1, memoryAmount: 1, storageAmount: 1, ...input.deployment } as NamedDeploymentDto;

    render(
      <DeploymentCard
        deployment={deployment}
        providers={[]}
        isSelectable={input.isSelectable}
        onSelect={onSelect}
        dependencies={MockComponents(DEPENDENCIES, { useDeploymentReachability, DeploymentStatusBadge, DeploymentEndpoints, DeploymentSpecSummary })}
      />
    );

    return { onSelect, DeploymentStatusBadge, DeploymentEndpoints, DeploymentSpecSummary };
  }
});
