import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ResolvedDeploymentStatus } from "@src/hooks/useDeploymentStatus/useDeploymentStatus";
import { useDeploymentStatus } from "@src/hooks/useDeploymentStatus/useDeploymentStatus";
import type { LeaseDto, ListedDeploymentDto } from "@src/types/deployment";
import { DeploymentStatusBadge as RealDeploymentStatusBadge } from "../DeploymentDetail/DeploymentStatusBadge";
import type { VisitEndpoint } from "../DeploymentDetail/DeploymentVisitControl/visitEndpoints";
import { DEPENDENCIES, DeploymentRow } from "./DeploymentRow";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildActivity } from "@tests/seeders/activity";
import { activityFeedOf } from "@tests/unit/activityFeed";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentRow", () => {
  it("links the deployment name to its detail page", () => {
    setup({ deployment: { dseq: "100", name: "acme-storefront" } });

    expect(screen.getByRole("link", { name: "acme-storefront" })).toHaveAttribute("href", "/deployments/100");
  });

  it("renders status, endpoints and hardware as separate cells", () => {
    setup({ deployment: { dseq: "100" } });

    expect(screen.getAllByRole("cell")).toHaveLength(5);
  });

  it("offers selection from the controls cell rather than a column of its own", () => {
    setup({ deployment: { dseq: "100", name: "acme" }, isSelectable: true });

    expect(screen.getByRole("checkbox", { name: "Select deployment acme" })).toBeInTheDocument();
    expect(screen.getAllByRole("cell")).toHaveLength(5);
  });

  it("resolves reachability for this deployment against the provider list", () => {
    const { useDeploymentReachability, providers, deployment } = setup({ deployment: { dseq: "100" } });

    expect(useDeploymentReachability).toHaveBeenCalledWith({ deployment, providers });
  });

  it("resolves the status through the hook the card and the deployment page header share", () => {
    const leases = [mock<LeaseDto>({ state: "active" })];
    const status: ResolvedDeploymentStatus = { label: "Spinning up", summaryLabel: "Spinning up", tone: "loading", isSpinningUp: true };
    const { DeploymentStatusBadge, useDeploymentStatus } = setup({ deployment: { dseq: "100" }, leases, workload: "starting", status });

    expect(useDeploymentStatus).toHaveBeenCalledWith({ dseq: "100", state: "active", leases, workload: "starting" });
    expect(DeploymentStatusBadge).toHaveBeenCalledWith({ status, leases, isSummarized: true }, expect.anything());
  });

  it("shows a deployment whose lease is still being created as spinning up, as its card does", () => {
    setup({
      deployment: { dseq: "100" },
      dependencies: {
        DeploymentStatusBadge: RealDeploymentStatusBadge,
        useDeploymentStatus: params =>
          useDeploymentStatus({
            ...params,
            dependencies: activityFeedOf([buildActivity({ type: "lease_create", status: "pending", meta: { dseq: "100" } })])
          })
      }
    });

    expect(screen.getByText("Spinning up")).toBeInTheDocument();
  });

  it("tells the endpoints view a deployment is spinning up", () => {
    const { DeploymentEndpoints } = setup({ deployment: { dseq: "100" }, status: { isSpinningUp: true } });

    expect(DeploymentEndpoints).toHaveBeenCalledWith(expect.objectContaining({ isSpinningUp: true }), expect.anything());
  });

  it("offers to choose a provider again in the endpoint cell once the lease failed", () => {
    const leases = [mock<LeaseDto>({ state: "active" })];
    const { DeploymentEndpoints, DeploymentRecoveryAction } = setup({
      deployment: { dseq: "100" },
      leases,
      status: { launch: { phase: "failed", providers: [], hasLease: false } }
    });

    expect(DeploymentRecoveryAction).toHaveBeenCalledWith({ dseq: "100", hasLease: false, leases, isCompact: true }, expect.anything());
    expect(DeploymentEndpoints).not.toHaveBeenCalled();
  });

  it("hands the recovery action no leases before the deployment's leases have loaded", () => {
    const { DeploymentRecoveryAction } = setup({
      deployment: { dseq: "100" },
      leases: null,
      status: { launch: { phase: "failed", providers: [], hasLease: true } }
    });

    expect(DeploymentRecoveryAction).toHaveBeenCalledWith(expect.objectContaining({ leases: [] }), expect.anything());
  });

  it("falls back to the dseq when the deployment has no local name", () => {
    setup({ deployment: { dseq: "100", name: "" } });

    expect(screen.getByRole("link", { name: "Deployment #100" })).toBeInTheDocument();
  });

  it("reports a shift-click so a range of rows can be selected at once", async () => {
    const { onSelect } = setup({ deployment: { dseq: "100", name: "acme" }, isSelectable: true });
    const user = userEvent.setup();

    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("checkbox", { name: "Select deployment acme" }));

    expect(onSelect).toHaveBeenCalledWith({ id: "100", isShiftPressed: true });
  });

  it("marks the checkbox for a row that is already selected", () => {
    setup({ deployment: { dseq: "100", name: "acme" }, isSelectable: true, isSelected: true });

    expect(screen.getByRole("checkbox", { name: "Select deployment acme" })).toBeChecked();
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

  it("keeps the endpoints out of the row until they are asked for", () => {
    const { DeploymentEndpointsPanel } = setup({ deployment: { dseq: "100" }, endpoints: [endpoint("api.acmecorp.com")] });

    expect(DeploymentEndpointsPanel).not.toHaveBeenCalled();
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });

  it("opens the endpoints into a row of their own rather than the endpoint cell", async () => {
    const endpoints = [endpoint("api.acmecorp.com"), endpoint("shop.acmecorp.com")];
    const { DeploymentEndpointsPanel } = setup({ deployment: { dseq: "100" }, endpoints });

    await userEvent.click(screen.getByRole("button", { name: "toggle endpoints" }));

    expect(DeploymentEndpointsPanel).toHaveBeenCalledWith({ endpoints }, expect.anything());
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("spans the whole table with the endpoint panel, so a long host reads on one line", async () => {
    setup({ deployment: { dseq: "100" }, endpoints: [endpoint("api.acmecorp.com"), endpoint("shop.acmecorp.com")] });

    await userEvent.click(screen.getByRole("button", { name: "toggle endpoints" }));

    expect(screen.getAllByRole("cell").at(-1)).toHaveAttribute("colspan", "5");
  });

  it("closes the endpoint row again on demand", async () => {
    setup({ deployment: { dseq: "100" }, endpoints: [endpoint("api.acmecorp.com"), endpoint("shop.acmecorp.com")] });

    await userEvent.click(screen.getByRole("button", { name: "toggle endpoints" }));
    await userEvent.click(screen.getByRole("button", { name: "toggle endpoints" }));

    expect(screen.getAllByRole("row")).toHaveLength(1);
  });

  it("reports the row as expanded to the endpoint toggle that drew it", async () => {
    const { DeploymentEndpoints } = setup({ deployment: { dseq: "100" }, endpoints: [endpoint("api.acmecorp.com"), endpoint("shop.acmecorp.com")] });

    await userEvent.click(screen.getByRole("button", { name: "toggle endpoints" }));

    expect(DeploymentEndpoints).toHaveBeenLastCalledWith(expect.objectContaining({ isExpanded: true }), expect.anything());
  });

  it("closes an open endpoint panel when a poll drops the row below two endpoints", async () => {
    const { rerenderWith } = setup({ deployment: { dseq: "100" }, endpoints: [endpoint("api.acmecorp.com"), endpoint("shop.acmecorp.com")] });

    await userEvent.click(screen.getByRole("button", { name: "toggle endpoints" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);

    rerenderWith([endpoint("api.acmecorp.com")]);

    expect(screen.getAllByRole("row")).toHaveLength(1);
  });

  function endpoint(host: string): VisitEndpoint {
    return { serviceName: "api", host, port: 443, href: `http://${host}:443` };
  }

  it("keeps the trial and interconnect badges in the status cell, so a badge cannot deepen the row", () => {
    const { DeploymentBadges, deployment } = setup({ deployment: { dseq: "100", name: "acme" } });

    expect(screen.getAllByRole("cell")[0]).toContainElement(screen.getByText("badges"));
    expect(DeploymentBadges.mock.calls[0][0]).toEqual(expect.objectContaining({ deployment }));
  });

  it("leaves the deployment cell to the name alone, so its column keeps its declared width", () => {
    setup({ deployment: { dseq: "100", name: "acme" } });

    expect(screen.getAllByRole("cell")[1]).not.toContainElement(screen.getByText("badges"));
  });

  function setup(input: {
    deployment: Partial<ListedDeploymentDto> & { dseq: string };
    isSelectable?: boolean;
    isSelected?: boolean;
    isClosing?: boolean;
    endpoints?: VisitEndpoint[];
    leases?: LeaseDto[] | null;
    workload?: "starting";
    status?: Partial<ResolvedDeploymentStatus>;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    let endpoints = input.endpoints ?? [];
    const useDeploymentReachability = vi.fn<typeof DEPENDENCIES.useDeploymentReachability>(() => ({
      leases: input.leases === undefined ? [] : input.leases,
      isLoadingLeases: false,
      workload: input.workload,
      endpoints,
      isLoadingEndpoints: false,
      unreachableReason: null
    }));
    const useDeploymentStatus = vi.fn<typeof DEPENDENCIES.useDeploymentStatus>(() => ({
      label: "Running",
      summaryLabel: "Running",
      tone: "running",
      ...input.status
    }));
    const DeploymentRecoveryAction = vi.fn(() => <div>recovery</div>);

    const DeploymentEndpoints = vi.fn<typeof DEPENDENCIES.DeploymentEndpoints>(({ onToggleExpanded }) => (
      <button type="button" onClick={onToggleExpanded}>
        toggle endpoints
      </button>
    ));
    const DeploymentEndpointsPanel = vi.fn<typeof DEPENDENCIES.DeploymentEndpointsPanel>(() => <div>endpoints panel</div>);
    const DeploymentBadges = vi.fn<typeof DEPENDENCIES.DeploymentBadges>(() => <div>badges</div>);
    const DeploymentStatusBadge = vi.fn(() => <div>status</div>);
    const DeploymentActionsMenu = vi.fn(() => <div>actions</div>);

    const providers: never[] = [];
    const onSelect = vi.fn();
    const deployment = { state: "active", ...input.deployment } as ListedDeploymentDto;

    const renderRow = () => (
      <table>
        <tbody>
          <DeploymentRow
            deployment={deployment}
            providers={providers}
            isSelectable={input.isSelectable}
            isSelected={input.isSelected}
            isClosing={input.isClosing}
            onSelect={onSelect}
            dependencies={MockComponents(DEPENDENCIES, {
              useDeploymentReachability,
              useDeploymentStatus,
              DeploymentRecoveryAction,
              DeploymentEndpoints,
              DeploymentEndpointsPanel,
              DeploymentBadges,
              DeploymentStatusBadge,
              DeploymentActionsMenu,
              ...input.dependencies
            })}
          />
        </tbody>
      </table>
    );

    const { rerender } = render(renderRow());

    return {
      ...input,
      onSelect,
      useDeploymentReachability,
      useDeploymentStatus,
      DeploymentRecoveryAction,
      providers,
      deployment,
      DeploymentEndpoints,
      DeploymentEndpointsPanel,
      DeploymentBadges,
      DeploymentStatusBadge,
      DeploymentActionsMenu,
      rerenderWith(next: VisitEndpoint[]) {
        endpoints = next;
        rerender(renderRow());
      }
    };
  }
});
