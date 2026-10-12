import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ResolvedDeploymentStatus } from "@src/hooks/useDeploymentStatus/useDeploymentStatus";
import { useDeploymentStatus } from "@src/hooks/useDeploymentStatus/useDeploymentStatus";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { LeaseDto, ListedDeploymentDto } from "@src/types/deployment";
import { DeploymentStatusBadge as RealDeploymentStatusBadge } from "../DeploymentDetail/DeploymentStatusBadge";
import type { VisitEndpoint } from "../DeploymentDetail/DeploymentVisitControl/visitEndpoints";
import { DEPENDENCIES, DeploymentCard } from "./DeploymentCard";
import type { DeploymentReachability } from "./useDeploymentReachability";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildActivity } from "@tests/seeders/activity";
import { activityFeedOf } from "@tests/unit/activityFeed";
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

  it("resolves the status through the hook the deployment page header shares, from the deployment, its leases and what its providers report", () => {
    const leases = [mock<LeaseDto>({ state: "active" })];
    const status: ResolvedDeploymentStatus = { label: "Spinning up", summaryLabel: "Spinning up", tone: "loading", isSpinningUp: true };
    const { DeploymentStatusBadge, useDeploymentStatus } = setup({ deployment: { dseq: "100" }, leases, reachability: { workload: "starting" }, status });

    expect(useDeploymentStatus).toHaveBeenCalledWith({ dseq: "100", state: "active", leases, workload: "starting" });
    expect(DeploymentStatusBadge).toHaveBeenCalledWith({ status, leases, isSummarized: true }, expect.anything());
  });

  it("shows a deployment whose lease is still being created as spinning up, as its page header does", () => {
    setup({
      deployment: { dseq: "100" },
      dependencies: {
        DeploymentStatusBadge: RealDeploymentStatusBadge,
        useDeploymentStatus: params => useDeploymentStatus({ ...params, dependencies: activityFeedOf([leaseCreation("pending")]) })
      }
    });

    expect(screen.getByText("Spinning up")).toBeInTheDocument();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
  });

  it("tells the endpoints view a deployment is spinning up, so it does not read as one without a provider", () => {
    const { DeploymentEndpoints } = setup({ deployment: { dseq: "100" }, status: { isSpinningUp: true } });

    expect(DeploymentEndpoints).toHaveBeenCalledWith(expect.objectContaining({ isSpinningUp: true }), expect.anything());
  });

  it("offers to choose a provider again in place of the endpoints once the lease failed", () => {
    const leases = [mock<LeaseDto>({ state: "active" })];
    const { DeploymentEndpoints, DeploymentRecoveryAction } = setup({
      deployment: { dseq: "100" },
      leases,
      status: { label: "Deploy failed", launch: { phase: "failed", providers: [], hasLease: true } }
    });

    expect(DeploymentRecoveryAction).toHaveBeenCalledWith({ dseq: "100", hasLease: true, leases, isCompact: true }, expect.anything());
    expect(DeploymentEndpoints).not.toHaveBeenCalled();
  });

  it("hands the recovery action no leases before the deployment's leases have loaded", () => {
    const { DeploymentRecoveryAction } = setup({
      deployment: { dseq: "100" },
      reachability: { leases: undefined },
      status: { launch: { phase: "failed", providers: [], hasLease: false } }
    });

    expect(DeploymentRecoveryAction).toHaveBeenCalledWith(expect.objectContaining({ hasLease: false, leases: [] }), expect.anything());
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

  it("keeps the endpoints out of the card until they are asked for", () => {
    const { DeploymentEndpointsPanel } = setup({ deployment: { dseq: "100" } });

    expect(DeploymentEndpointsPanel).not.toHaveBeenCalled();
  });

  it("opens the endpoints inside the card, which has no row to spill into", async () => {
    const { DeploymentEndpointsPanel } = setup({
      deployment: { dseq: "100" },
      reachability: { endpoints: [endpoint("one.example.com"), endpoint("two.example.com")] }
    });

    await userEvent.click(screen.getByRole("button", { name: "toggle endpoints" }));

    expect(DeploymentEndpointsPanel).toHaveBeenCalled();
  });

  it("closes the endpoints again on demand", async () => {
    setup({ deployment: { dseq: "100" }, reachability: { endpoints: [endpoint("one.example.com"), endpoint("two.example.com")] } });

    await userEvent.click(screen.getByRole("button", { name: "toggle endpoints" }));
    await userEvent.click(screen.getByRole("button", { name: "toggle endpoints" }));

    expect(screen.queryByText("endpoints panel")).not.toBeInTheDocument();
  });

  it("closes an open endpoint panel when a poll drops the card below two endpoints", async () => {
    const { rerenderWith } = setup({ deployment: { dseq: "100" }, reachability: { endpoints: [endpoint("one.example.com"), endpoint("two.example.com")] } });

    await userEvent.click(screen.getByRole("button", { name: "toggle endpoints" }));
    expect(screen.getByText("endpoints panel")).toBeInTheDocument();

    rerenderWith([endpoint("one.example.com")]);

    expect(screen.queryByText("endpoints panel")).not.toBeInTheDocument();
  });

  function endpoint(host: string): VisitEndpoint {
    return { serviceName: "web", host, port: 80, href: `http://${host}:80` };
  }

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

  it("resolves reachability for this deployment against the provider list", () => {
    const { useDeploymentReachability, providers, deployment } = setup({ deployment: { dseq: "100" } });

    expect(useDeploymentReachability).toHaveBeenCalledWith({ deployment, providers });
  });

  it("reports a plain click as a non-range selection", async () => {
    const { onSelect } = setup({ deployment: { dseq: "100", name: "acme" }, isSelectable: true });

    await userEvent.click(screen.getByRole("checkbox", { name: "Select deployment acme" }));

    expect(onSelect).toHaveBeenCalledWith({ id: "100", isShiftPressed: false });
  });

  it("marks the checkbox for a deployment that is already selected", () => {
    setup({ deployment: { dseq: "100", name: "acme" }, isSelectable: true, isSelected: true });

    expect(screen.getByRole("checkbox", { name: "Select deployment acme" })).toBeChecked();
  });

  it("hands the actions menu the deployment and the refresh to run after a close", () => {
    const onDeploymentClosed = vi.fn();
    const { DeploymentActionsMenu, deployment } = setup({ deployment: { dseq: "100" }, onDeploymentClosed });

    expect(DeploymentActionsMenu).toHaveBeenCalledWith({ deployment, onDeploymentClosed, isClosing: false }, expect.anything());
  });

  describe("while the deployment's close runs in the background", () => {
    it("offers no selection, so it cannot join a bulk close", () => {
      setup({ deployment: { dseq: "100" }, isSelectable: true, isClosing: true });

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("tells the actions menu the deployment is closing", () => {
      const { DeploymentActionsMenu } = setup({ deployment: { dseq: "100" }, isClosing: true });

      expect(DeploymentActionsMenu).toHaveBeenCalledWith(expect.objectContaining({ isClosing: true }), expect.anything());
    });
  });

  it("offers no selection when the collection cannot be acted on in bulk", () => {
    setup({ deployment: { dseq: "100" } });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("seats the deployment's own trial and interconnect badges beside the status", () => {
    const { DeploymentBadges, deployment } = setup({ deployment: { dseq: "100", name: "acme" } });

    expect(screen.getByText("badges").parentElement).toBe(screen.getByText("status").parentElement);
    expect(DeploymentBadges.mock.calls[0][0]).toEqual(expect.objectContaining({ deployment }));
  });

  function setup(input: {
    deployment: Partial<ListedDeploymentDto> & { dseq: string };
    leases?: LeaseDto[];
    reachability?: Partial<DeploymentReachability>;
    isSelectable?: boolean;
    isSelected?: boolean;
    isClosing?: boolean;
    status?: Partial<ResolvedDeploymentStatus>;
    onDeploymentClosed?: () => void;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const leases = input.leases ?? [];
    let endpoints = input.reachability?.endpoints ?? [];
    const useDeploymentReachability = vi.fn<typeof DEPENDENCIES.useDeploymentReachability>(() => ({
      leases,
      isLoadingLeases: false,
      workload: undefined,
      isLoadingEndpoints: false,
      unreachableReason: null,
      ...input.reachability,
      endpoints
    }));

    const useDeploymentStatus = vi.fn<typeof DEPENDENCIES.useDeploymentStatus>(() => ({
      label: "Running",
      summaryLabel: "Running",
      tone: "running",
      ...input.status
    }));
    const DeploymentStatusBadge = vi.fn(() => <div>status</div>);
    const DeploymentRecoveryAction = vi.fn(() => <div>recovery</div>);
    const DeploymentEndpoints = vi.fn<typeof DEPENDENCIES.DeploymentEndpoints>(({ onToggleExpanded }) => (
      <button type="button" onClick={onToggleExpanded}>
        toggle endpoints
      </button>
    ));
    const DeploymentEndpointsPanel = vi.fn<typeof DEPENDENCIES.DeploymentEndpointsPanel>(() => <div>endpoints panel</div>);
    const DeploymentSpecSummary = vi.fn(() => <div>specs</div>);
    const DeploymentActionsMenu = vi.fn(() => <div>actions</div>);
    const DeploymentBadges = vi.fn<typeof DEPENDENCIES.DeploymentBadges>(() => <div>badges</div>);
    const providers: never[] = [];
    const onSelect = vi.fn();
    const deployment = { state: "active", cpuAmount: 1, memoryAmount: 1, storageAmount: 1, ...input.deployment } as ListedDeploymentDto;

    const renderCard = () => (
      <DeploymentCard
        deployment={deployment}
        providers={providers}
        isSelectable={input.isSelectable}
        isSelected={input.isSelected}
        isClosing={input.isClosing}
        onSelect={onSelect}
        onDeploymentClosed={input.onDeploymentClosed}
        dependencies={MockComponents(DEPENDENCIES, {
          useDeploymentReachability,
          useDeploymentStatus,
          DeploymentStatusBadge,
          DeploymentRecoveryAction,
          DeploymentEndpoints,
          DeploymentEndpointsPanel,
          DeploymentSpecSummary,
          DeploymentActionsMenu,
          DeploymentBadges,
          ...input.dependencies
        })}
      />
    );

    const { rerender } = render(renderCard());

    return {
      onSelect,
      rerenderWith(next: VisitEndpoint[]) {
        endpoints = next;
        rerender(renderCard());
      },
      DeploymentStatusBadge,
      DeploymentRecoveryAction,
      DeploymentEndpoints,
      DeploymentEndpointsPanel,
      DeploymentSpecSummary,
      DeploymentActionsMenu,
      DeploymentBadges,
      useDeploymentReachability,
      useDeploymentStatus,
      providers,
      deployment
    };
  }
});

function leaseCreation(status: Activity["status"]) {
  return buildActivity({ type: "lease_create", status, meta: { dseq: "100", providers: ["akash1provider"] } });
}
