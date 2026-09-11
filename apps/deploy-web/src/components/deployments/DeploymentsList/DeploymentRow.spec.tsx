import { describe, expect, it, vi } from "vitest";

import type { NamedDeploymentDto } from "@src/types/deployment";
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

  it("adds a selection cell only when the collection can be acted on in bulk", () => {
    setup({ deployment: { dseq: "100", name: "acme" }, isSelectable: true });

    expect(screen.getByRole("checkbox", { name: "Select deployment acme" })).toBeInTheDocument();
    expect(screen.getAllByRole("cell")).toHaveLength(6);
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

  function setup(input: { deployment: Partial<NamedDeploymentDto> & { dseq: string }; isSelectable?: boolean; isSelected?: boolean }) {
    const useDeploymentReachability = vi.fn<typeof DEPENDENCIES.useDeploymentReachability>(() => ({
      leases: [],
      isLoadingLeases: false,
      endpoints: [],
      isLoadingEndpoints: false,
      unreachableReason: null
    }));

    const providers: never[] = [];
    const onSelect = vi.fn();
    const deployment = { state: "active", ...input.deployment } as NamedDeploymentDto;

    render(
      <table>
        <tbody>
          <DeploymentRow
            deployment={deployment}
            providers={providers}
            isSelectable={input.isSelectable}
            isSelected={input.isSelected}
            onSelect={onSelect}
            dependencies={MockComponents(DEPENDENCIES, { useDeploymentReachability })}
          />
        </tbody>
      </table>
    );

    return { ...input, onSelect, useDeploymentReachability, providers, deployment };
  }
});
