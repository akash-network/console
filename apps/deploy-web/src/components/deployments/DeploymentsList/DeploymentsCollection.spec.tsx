import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentsViewMode } from "@src/store/deploymentsViewStore";
import type { ListedDeploymentDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentsCollection } from "./DeploymentsCollection";
import type { CreatingDeployment } from "./useCreatingDeployments";

import { cleanup, render, screen } from "@testing-library/react";
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

  it("stands in placeholder cards while the grid is loading", () => {
    const { DeploymentCard } = setup({ viewMode: "grid", dseqs: [], isLoading: true });

    expect(screen.getAllByTestId("deployment-placeholder").length).toBeGreaterThan(0);
    expect(DeploymentCard).not.toHaveBeenCalled();
  });

  it("stands in placeholder rows under the real headers while the list is loading", () => {
    const { DeploymentRow } = setup({ viewMode: "list", dseqs: [], isLoading: true });

    expect(screen.getAllByTestId("deployment-placeholder").length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader", { name: "Hardware" })).toBeInTheDocument();
    expect(DeploymentRow).not.toHaveBeenCalled();
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

  it("treats a collection with no selection as nothing selected", () => {
    const { DeploymentCard } = setup({ viewMode: "grid", dseqs: ["100"] });

    expect(DeploymentCard).toHaveBeenCalledWith(expect.objectContaining({ isSelected: false }), expect.anything());
  });

  it("offers no selection on a deployment of a project the caller only views", () => {
    const { DeploymentRow } = setup({ viewMode: "list", dseqs: ["100", "101"], viewedProjectId: "project-of-101" });

    expect(DeploymentRow).toHaveBeenCalledWith(
      expect.objectContaining({ deployment: expect.objectContaining({ dseq: "100" }), isSelectable: true, canManage: true }),
      expect.anything()
    );
    expect(DeploymentRow).toHaveBeenCalledWith(
      expect.objectContaining({ deployment: expect.objectContaining({ dseq: "101" }), isSelectable: false, canManage: false }),
      expect.anything()
    );
  });

  it("keeps the same columns whether or not the collection is selectable", () => {
    setup({ viewMode: "list", dseqs: ["100"], isSelectable: true });
    expect(screen.getAllByRole("columnheader")).toHaveLength(5);

    cleanup();

    setup({ viewMode: "list", dseqs: ["100"], isSelectable: false });
    expect(screen.getAllByRole("columnheader")).toHaveLength(5);
  });

  it.each(["grid", "list"] as const)("marks the deployments whose close runs in the background in the %s view", viewMode => {
    const { DeploymentCard, DeploymentRow } = setup({ viewMode, dseqs: ["100", "101"], closingDseqs: new Set(["101"]) });
    const Item = viewMode === "grid" ? DeploymentCard : DeploymentRow;

    expect(Item).toHaveBeenCalledWith(expect.objectContaining({ deployment: expect.objectContaining({ dseq: "100" }), isClosing: false }), expect.anything());
    expect(Item).toHaveBeenCalledWith(expect.objectContaining({ deployment: expect.objectContaining({ dseq: "101" }), isClosing: true }), expect.anything());
  });

  it("treats a collection that names no closing deployments as none closing", () => {
    const { DeploymentCard } = setup({ viewMode: "grid", dseqs: ["100"] });

    expect(DeploymentCard).toHaveBeenCalledWith(expect.objectContaining({ isClosing: false }), expect.anything());
  });

  it("passes the close callback through to every item", () => {
    const onDeploymentClosed = vi.fn();
    const { DeploymentCard } = setup({ viewMode: "grid", dseqs: ["100"], onDeploymentClosed });

    expect(DeploymentCard).toHaveBeenCalledWith(expect.objectContaining({ onDeploymentClosed }), expect.anything());
  });

  it.each(["grid", "list"] as const)("puts the deployments still being created on top in the %s view, named and not opened", viewMode => {
    setup({ viewMode, dseqs: ["100"], isLoading: true, creating: [{ dseq: "300", name: "web" }] });

    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("Creating")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each(["grid", "list"] as const)("puts nothing on top in the %s view while nothing is being created", viewMode => {
    setup({ viewMode, dseqs: ["100"] });

    expect(screen.queryByText("Creating")).not.toBeInTheDocument();
    expect(screen.queryByText("New deployment")).not.toBeInTheDocument();
  });

  it.each(["grid", "list"] as const)("calls a deployment still being created that has no name yet a new deployment in the %s view", viewMode => {
    setup({ viewMode, dseqs: [], creating: [{ dseq: "300", name: null }] });

    expect(screen.getByText("New deployment")).toBeInTheDocument();
  });

  function setup(input: {
    viewMode: DeploymentsViewMode;
    dseqs: string[];
    creating?: CreatingDeployment[];
    isLoading?: boolean;
    selectedIds?: string[];
    isSelectable?: boolean;
    closingDseqs?: ReadonlySet<string>;
    onDeploymentClosed?: () => void;
    viewedProjectId?: string;
  }) {
    const DeploymentCard = vi.fn(() => <div>card</div>);
    const DeploymentRow = vi.fn(() => <tr />);
    const useProjectAccess: typeof DEPENDENCIES.useProjectAccess = () =>
      mock<ReturnType<typeof DEPENDENCIES.useProjectAccess>>({ canManageDeployments: projectId => projectId !== input.viewedProjectId });

    render(
      <DeploymentsCollection
        deployments={input.dseqs.map(dseq => ({ dseq, state: "active", projectId: `project-of-${dseq}` }) as ListedDeploymentDto)}
        creatingDeployments={input.creating}
        providers={[]}
        viewMode={input.viewMode}
        isLoading={input.isLoading}
        isSelectable={input.isSelectable ?? true}
        selectedIds={input.selectedIds}
        closingDseqs={input.closingDseqs}
        onDeploymentClosed={input.onDeploymentClosed}
        dependencies={MockComponents(DEPENDENCIES, { useProjectAccess, DeploymentCard, DeploymentRow })}
      />
    );

    return { DeploymentCard, DeploymentRow };
  }
});
