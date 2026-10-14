import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Project, ProjectDeploymentPreview, ProjectDeploymentStatus } from "@src/types/project";
import { ProjectFolder } from "./ProjectFolder";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ProjectFolder.name, () => {
  it("claims no count while the project's deployments are unknown", () => {
    setup({ isSummaryUnknown: true });

    expect(screen.getByRole("link", { name: "Open storefront" })).toBeInTheDocument();
    expect(screen.queryByText(/Empty/)).not.toBeInTheDocument();
    expect(screen.getByText("Created Oct 28, 2025")).toBeInTheDocument();
  });

  it("calls a project without open deployments empty", () => {
    setup({});

    expect(screen.getByText("Empty · Created Oct 28, 2025")).toBeInTheDocument();
  });

  it("offers no new deployment sheet to a member who cannot deploy", () => {
    setup({ canDeploy: false });

    expect(screen.queryByText("New deployment")).not.toBeInTheDocument();
  });

  it("shows the project actions next to its name without opening the project from them", async () => {
    const { onOpen } = setup({ menu: <button type="button">project actions</button> });

    await userEvent.click(screen.getByRole("button", { name: "project actions" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "project actions" }), { key: "Enter" });

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("names the folder and its active deployments for assistive tech", () => {
    setup({ deployments: [deployment("web", "running"), deployment("db", "running")] });

    expect(screen.getByRole("link", { name: "Open storefront, 2 active deployments" })).toBeInTheDocument();
  });

  it("counts a single active deployment in the singular", () => {
    setup({ deployments: [deployment("web", "running")] });

    expect(screen.getByRole("link", { name: "Open storefront, 1 active deployment" })).toBeInTheDocument();
  });

  it("shows the name, the description and when it was created", () => {
    setup({ description: "Customer-facing shop.", deployments: [deployment("web", "running"), deployment("db", "running"), deployment("cache", "running")] });

    expect(screen.getByText("storefront")).toBeInTheDocument();
    expect(screen.getByText("Customer-facing shop.")).toBeInTheDocument();
    expect(screen.getByText("3 active · Created Oct 28, 2025")).toBeInTheDocument();
  });

  it("reads as empty without a description or deployments", () => {
    setup({});

    expect(screen.getByText("No description")).toBeInTheDocument();
    expect(screen.getByText("Empty · Created Oct 28, 2025")).toBeInTheDocument();
  });

  it("files up to three sheets, problems first", () => {
    const { sheetNames } = setup({ deployments: [deployment("web", "running"), deployment("cache", "reclaiming"), deployment("db", "running")] });

    expect(sheetNames()).toEqual(["cache", "web", "db"]);
  });

  it("flags a problem sheet with its status while a healthy sheet shows none", () => {
    setup({ deployments: [deployment("web", "running"), deployment("cache", "reclaiming")] });

    expect(screen.getByText("Reclaiming")).toBeInTheDocument();
    expect(screen.getByText("cache").closest("[data-flag]")).not.toBeNull();
    expect(screen.getByText("web").closest("[data-flag]")).toBeNull();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
  });

  it("folds a bigger project into two sheets, a count and bulk edges", () => {
    const { sheetNames, bulkEdges } = setup({
      activeCount: 5,
      deployments: [deployment("web", "running"), deployment("db", "running"), deployment("cache", "running")]
    });

    expect(sheetNames()).toEqual(["web", "db"]);
    expect(screen.getByText("+3 more")).toBeInTheDocument();
    expect(bulkEdges()).toHaveLength(2);
  });

  it("offers a new deployment on a sheet when nothing is filed", () => {
    setup({});

    expect(screen.getByText("New deployment")).toBeInTheDocument();
  });

  it("opens the project on click", async () => {
    const { onOpen } = setup({});

    await userEvent.click(screen.getByRole("link"));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it.each(["{Enter}", " "])("opens the project on %j from the keyboard", async key => {
    const { onOpen } = setup({});

    screen.getByRole("link").focus();
    await userEvent.keyboard(key);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys", async () => {
    const { onOpen } = setup({});

    screen.getByRole("link").focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("opens the deployment behind a sheet instead of the project", async () => {
    const { onOpen, onSelectDeployment } = setup({ deployments: [deployment("web", "running")] });

    await userEvent.click(screen.getByText("web"));

    expect(onSelectDeployment).toHaveBeenCalledWith(deployment("web", "running"));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("opens the project once from the count sheet", async () => {
    const { onOpen, onSelectDeployment } = setup({ activeCount: 4, deployments: [deployment("web", "running"), deployment("db", "running")] });

    await userEvent.click(screen.getByText("+2 more"));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onSelectDeployment).not.toHaveBeenCalled();
  });

  it("starts a new deployment from the empty sheet instead of opening the project", async () => {
    const { onOpen, onNewDeployment } = setup({});

    await userEvent.click(screen.getByText("New deployment"));

    expect(onNewDeployment).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("keeps the sheets out of the accessibility tree", () => {
    setup({ deployments: [deployment("web", "running")] });

    expect(screen.getByText("web").closest("[aria-hidden='true']")).not.toBeNull();
  });

  function setup(input: {
    description?: string;
    deployments?: ProjectDeploymentPreview[];
    activeCount?: number;
    isSummaryUnknown?: boolean;
    canDeploy?: boolean;
    menu?: ReactNode;
  }) {
    const deployments = input.deployments ?? [];
    const project: Project = {
      id: "p-storefront",
      name: "storefront",
      slug: "storefront",
      description: input.description ?? null,
      isDefault: false,
      createdAt: "2025-10-28T12:00:00.000Z",
      createdBy: null,
      deploymentSummary: input.isSummaryUnknown ? undefined : { activeCount: input.activeCount ?? deployments.length, preview: deployments }
    };
    const onOpen = vi.fn();
    const onSelectDeployment = vi.fn();
    const onNewDeployment = vi.fn();

    const { container } = render(
      <ProjectFolder
        project={project}
        onOpen={onOpen}
        onSelectDeployment={onSelectDeployment}
        onNewDeployment={input.canDeploy === false ? undefined : onNewDeployment}
        menu={input.menu}
      />
    );

    const sheetNames = () => Array.from(container.querySelectorAll("[class*='sheetName']")).map(element => element.textContent);
    const bulkEdges = () => container.querySelectorAll("[class*='bulk']");

    return { onOpen, onSelectDeployment, onNewDeployment, sheetNames, bulkEdges };
  }
});

function deployment(name: string, status: ProjectDeploymentStatus): ProjectDeploymentPreview {
  return { dseq: `dseq-${name}`, name, status };
}
