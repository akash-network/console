import { describe, expect, it, vi } from "vitest";

import type { NamedDeploymentDto } from "@src/types/deployment";
import type { VisitEndpoint } from "../DeploymentDetail/DeploymentVisitControl/visitEndpoints";
import { DEPENDENCIES, DeploymentRow } from "./DeploymentRow";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  function setup(input: {
    deployment: Partial<NamedDeploymentDto> & { dseq: string };
    isSelectable?: boolean;
    isSelected?: boolean;
    endpoints?: VisitEndpoint[];
  }) {
    let endpoints = input.endpoints ?? [];
    const useDeploymentReachability = vi.fn<typeof DEPENDENCIES.useDeploymentReachability>(() => ({
      leases: [],
      isLoadingLeases: false,
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

    const providers: never[] = [];
    const onSelect = vi.fn();
    const deployment = { state: "active", ...input.deployment } as NamedDeploymentDto;

    const renderRow = () => (
      <table>
        <tbody>
          <DeploymentRow
            deployment={deployment}
            providers={providers}
            isSelectable={input.isSelectable}
            isSelected={input.isSelected}
            onSelect={onSelect}
            dependencies={MockComponents(DEPENDENCIES, { useDeploymentReachability, DeploymentEndpoints, DeploymentEndpointsPanel })}
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
      rerenderWith(next: VisitEndpoint[]) {
        endpoints = next;
        rerender(renderRow());
      }
    };
  }
});
