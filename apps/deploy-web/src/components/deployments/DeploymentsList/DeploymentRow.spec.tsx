import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto, ListedDeploymentDto } from "@src/types/deployment";
import type { WorkloadStatus } from "../DeploymentDetail/DeploymentPlacements/placementModel";
import type { VisitEndpoint } from "../DeploymentDetail/DeploymentVisitControl/visitEndpoints";
import { DEPENDENCIES, DeploymentRow } from "./DeploymentRow";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentRow", () => {
  it("names the project the deployment is filed under", () => {
    const { DeploymentProjectChip } = setup({ deployment: { dseq: "100", projectId: "project-1" } });

    expect(DeploymentProjectChip.mock.lastCall?.[0]).toEqual({ projectId: "project-1" });
    expect(screen.getByText("project chip")).toBeInTheDocument();
  });

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

  describe("reading the status the way the deployment page does", () => {
    it("shows the deployment as starting while a service of a live lease has no ready replica", () => {
      setup({ deployment: { dseq: "100" }, leases: [mock<LeaseDto>({ state: "active" })], workload: "starting", isRenderingStatus: true });

      expect(screen.getByText("Starting")).toBeInTheDocument();
      expect(screen.queryByText("Running")).not.toBeInTheDocument();
    });

    it("shows the deployment as running once every service has a ready replica", () => {
      setup({ deployment: { dseq: "100" }, leases: [mock<LeaseDto>({ state: "active" })], workload: "running", isRenderingStatus: true });

      expect(screen.getByText("Running")).toBeInTheDocument();
    });

    it("warns when a provider stops answering", () => {
      setup({ deployment: { dseq: "100" }, leases: [mock<LeaseDto>({ state: "active" })], workload: "unreachable", isRenderingStatus: true });

      expect(screen.getByText("Provider not responding")).toBeInTheDocument();
      expect(screen.queryByText("Running")).not.toBeInTheDocument();
    });

    it("falls back to the chain state when the lease status is withheld from this token", () => {
      setup({ deployment: { dseq: "100" }, leases: [mock<LeaseDto>({ state: "active" })], workload: undefined, isRenderingStatus: true });

      expect(screen.getByText("Running")).toBeInTheDocument();
    });
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

  it("tells the actions menu whether the caller may manage the deployment", () => {
    const { DeploymentActionsMenu } = setup({ deployment: { dseq: "100" }, canManage: false });

    expect(DeploymentActionsMenu).toHaveBeenCalledWith(expect.objectContaining({ canManage: false }), expect.anything());
  });

  it("lets the actions menu act when nothing says otherwise", () => {
    const { DeploymentActionsMenu } = setup({ deployment: { dseq: "100" } });

    expect(DeploymentActionsMenu).toHaveBeenCalledWith(expect.objectContaining({ canManage: true }), expect.anything());
  });

  describe("while the deployment's close runs in the background", () => {
    it("shows the deployment as closing", () => {
      const { DeploymentStatusBadge } = setup({ deployment: { dseq: "100" }, isClosing: true });

      expect(DeploymentStatusBadge).toHaveBeenCalledWith(expect.objectContaining({ isClosing: true }), expect.anything());
    });

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
    canManage?: boolean;
    leases?: LeaseDto[];
    workload?: WorkloadStatus;
    isRenderingStatus?: boolean;
  }) {
    let endpoints = input.endpoints ?? [];
    const useDeploymentReachability = vi.fn<typeof DEPENDENCIES.useDeploymentReachability>(() => ({
      leases: input.leases ?? [],
      isLoadingLeases: false,
      workload: input.workload,
      endpoints,
      isLoadingEndpoints: false,
      unreachableReason: null
    }));

    const DeploymentEndpoints = vi.fn<typeof DEPENDENCIES.DeploymentEndpoints>(({ onToggleExpanded }) => (
      <button type="button" onClick={onToggleExpanded}>
        toggle endpoints
      </button>
    ));
    const DeploymentEndpointsPanel = vi.fn<typeof DEPENDENCIES.DeploymentEndpointsPanel>(() => <div>endpoints panel</div>);
    const DeploymentBadges = vi.fn<typeof DEPENDENCIES.DeploymentBadges>(() => <div>badges</div>);
    const DeploymentStatusBadge = vi.fn(() => <div>status</div>);
    const DeploymentActionsMenu = vi.fn(() => <div>actions</div>);
    const DeploymentProjectChip = vi.fn<typeof DEPENDENCIES.DeploymentProjectChip>(() => <span>project chip</span>);

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
            canManage={input.canManage}
            onSelect={onSelect}
            dependencies={MockComponents(DEPENDENCIES, {
              useDeploymentReachability,
              DeploymentEndpoints,
              DeploymentEndpointsPanel,
              DeploymentBadges,
              DeploymentStatusBadge: input.isRenderingStatus ? DEPENDENCIES.DeploymentStatusBadge : DeploymentStatusBadge,
              DeploymentActionsMenu,
              DeploymentProjectChip
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
      providers,
      deployment,
      DeploymentEndpoints,
      DeploymentEndpointsPanel,
      DeploymentBadges,
      DeploymentStatusBadge,
      DeploymentActionsMenu,
      DeploymentProjectChip,
      rerenderWith(next: VisitEndpoint[]) {
        endpoints = next;
        rerender(renderRow());
      }
    };
  }
});
