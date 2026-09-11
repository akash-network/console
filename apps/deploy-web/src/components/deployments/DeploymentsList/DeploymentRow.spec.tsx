import { describe, expect, it, vi } from "vitest";

import type { NamedDeploymentDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentRow } from "./DeploymentRow";

import { render, screen } from "@testing-library/react";
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

  function setup(input: { deployment: Partial<NamedDeploymentDto> & { dseq: string }; isSelectable?: boolean }) {
    const useDeploymentReachability = vi.fn<typeof DEPENDENCIES.useDeploymentReachability>(() => ({
      leases: [],
      isLoadingLeases: false,
      endpoints: [],
      isLoadingEndpoints: false,
      unreachableReason: null
    }));

    render(
      <table>
        <tbody>
          <DeploymentRow
            deployment={{ state: "active", ...input.deployment } as NamedDeploymentDto}
            providers={[]}
            isSelectable={input.isSelectable}
            dependencies={MockComponents(DEPENDENCIES, { useDeploymentReachability })}
          />
        </tbody>
      </table>
    );

    return input;
  }
});
