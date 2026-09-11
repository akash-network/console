import { describe, expect, it, vi } from "vitest";

import type { DeploymentsViewMode } from "@src/store/deploymentsViewStore";
import type { NamedDeploymentDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentsCollection } from "./DeploymentsCollection";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentsCollection", () => {
  it("renders a card per deployment in the grid view", () => {
    const { DeploymentCard, DeploymentRow } = setup({ viewMode: "grid", dseqs: ["100", "101"] });

    expect(DeploymentCard).toHaveBeenCalledTimes(2);
    expect(DeploymentRow).not.toHaveBeenCalled();
  });

  it("renders a labelled table in the list view", () => {
    const { DeploymentRow, DeploymentCard } = setup({ viewMode: "list", dseqs: ["100"] });

    expect(DeploymentRow).toHaveBeenCalledTimes(1);
    expect(DeploymentCard).not.toHaveBeenCalled();
    expect(screen.getByRole("columnheader", { name: "Endpoint" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Hardware" })).toBeInTheDocument();
  });

  it("marks the deployments the caller has selected", () => {
    const { DeploymentCard } = setup({ viewMode: "grid", dseqs: ["100", "101"], selectedIds: ["101"] });

    expect(DeploymentCard).toHaveBeenCalledWith(
      expect.objectContaining({ deployment: expect.objectContaining({ dseq: "100" }), isSelected: false }),
      expect.anything()
    );
    expect(DeploymentCard).toHaveBeenCalledWith(
      expect.objectContaining({ deployment: expect.objectContaining({ dseq: "101" }), isSelected: true }),
      expect.anything()
    );
  });

  function setup(input: { viewMode: DeploymentsViewMode; dseqs: string[]; selectedIds?: string[] }) {
    const DeploymentCard = vi.fn(() => <div>card</div>);
    const DeploymentRow = vi.fn(() => <tr />);

    render(
      <DeploymentsCollection
        deployments={input.dseqs.map(dseq => ({ dseq, state: "active" }) as NamedDeploymentDto)}
        providers={[]}
        viewMode={input.viewMode}
        isSelectable
        selectedIds={input.selectedIds}
        dependencies={MockComponents(DEPENDENCIES, { DeploymentCard, DeploymentRow })}
      />
    );

    return { DeploymentCard, DeploymentRow };
  }
});
