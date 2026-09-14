import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto, NamedDeploymentDto } from "@src/types/deployment";
import type { VisitEndpoint } from "../DeploymentDetail/DeploymentVisitControl/visitEndpoints";
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

  it("shows the reclamation countdown for the deployment's own leases", () => {
    const leases = [mock<LeaseDto>({ state: "reclaiming" })];
    const { ReclamationCountdown } = setup({ deployment: { dseq: "100" }, leases });

    expect(ReclamationCountdown).toHaveBeenCalledWith({ leases }, expect.anything());
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

    expect(DeploymentActionsMenu).toHaveBeenCalledWith({ deployment, onDeploymentClosed }, expect.anything());
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
    isSelected?: boolean;
    onDeploymentClosed?: () => void;
  }) {
    const leases = input.leases ?? [];
    let endpoints = input.reachability?.endpoints ?? [];
    const useDeploymentReachability = vi.fn<typeof DEPENDENCIES.useDeploymentReachability>(() => ({
      leases,
      isLoadingLeases: false,
      isLoadingEndpoints: false,
      unreachableReason: null,
      ...input.reachability,
      endpoints
    }));

    const DeploymentStatusBadge = vi.fn(() => <div>status</div>);
    const DeploymentEndpoints = vi.fn<typeof DEPENDENCIES.DeploymentEndpoints>(({ onToggleExpanded }) => (
      <button type="button" onClick={onToggleExpanded}>
        toggle endpoints
      </button>
    ));
    const DeploymentEndpointsPanel = vi.fn<typeof DEPENDENCIES.DeploymentEndpointsPanel>(() => <div>endpoints panel</div>);
    const DeploymentSpecSummary = vi.fn(() => <div>specs</div>);
    const ReclamationCountdown = vi.fn(() => <div>countdown</div>);
    const DeploymentActionsMenu = vi.fn(() => <div>actions</div>);
    const providers: never[] = [];
    const onSelect = vi.fn();
    const deployment = { state: "active", cpuAmount: 1, memoryAmount: 1, storageAmount: 1, ...input.deployment } as NamedDeploymentDto;

    const renderCard = () => (
      <DeploymentCard
        deployment={deployment}
        providers={providers}
        isSelectable={input.isSelectable}
        isSelected={input.isSelected}
        onSelect={onSelect}
        onDeploymentClosed={input.onDeploymentClosed}
        dependencies={MockComponents(DEPENDENCIES, {
          useDeploymentReachability,
          DeploymentStatusBadge,
          DeploymentEndpoints,
          DeploymentEndpointsPanel,
          DeploymentSpecSummary,
          ReclamationCountdown,
          DeploymentActionsMenu
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
      DeploymentEndpoints,
      DeploymentEndpointsPanel,
      DeploymentSpecSummary,
      ReclamationCountdown,
      DeploymentActionsMenu,
      useDeploymentReachability,
      providers,
      deployment
    };
  }
});
