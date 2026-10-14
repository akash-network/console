import { describe, expect, it, vi } from "vitest";

import type { Project } from "@src/types/project";
import { NEW_PROJECT_CHOICE, ProjectPicker } from "./ProjectPicker";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ProjectPicker.name, () => {
  it("lists each project with how many deployments it runs when that is known", () => {
    setup({ value: null });

    const storefront = screen.getByRole("radio", { name: "storefront" }).closest("label") as HTMLElement;
    expect(within(storefront).getByText("3 active")).toBeInTheDocument();
    const marketing = screen.getByRole("radio", { name: "marketing" }).closest("label") as HTMLElement;
    expect(within(marketing).queryByText(/active$/)).not.toBeInTheDocument();
    const checkout = screen.getByRole("radio", { name: "checkout" }).closest("label") as HTMLElement;
    expect(within(checkout).queryByText(/active$/)).not.toBeInTheDocument();
  });

  it("picks the project clicked", async () => {
    const { onChange } = setup({ value: null });

    await userEvent.click(screen.getByText("marketing"));

    expect(onChange).toHaveBeenCalledWith("marketing");
  });

  it("marks the picked project", () => {
    setup({ value: "storefront" });

    expect(screen.getByRole("radio", { name: "storefront" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "marketing" })).not.toBeChecked();
  });

  it("keeps an unavailable project from being picked", () => {
    setup({ value: null, unavailableProjectId: "storefront" });

    expect(screen.getByRole("radio", { name: "storefront" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "marketing" })).toBeEnabled();
  });

  it("offers no new project row unless asked to", () => {
    setup({ value: null });

    expect(screen.queryByRole("radio", { name: "Create a new project" })).not.toBeInTheDocument();
  });

  it("reveals the name field once a new project is picked", async () => {
    const { onChange, onNameChange } = setup({ value: NEW_PROJECT_CHOICE, withNewProject: true });

    expect(screen.getByRole("radio", { name: "Create a new project" })).toBeChecked();
    await userEvent.type(screen.getByLabelText("Project name"), "x");

    expect(onNameChange).toHaveBeenCalledWith("x");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the name field hidden while an existing project is picked", () => {
    setup({ value: "storefront", withNewProject: true });

    expect(screen.queryByLabelText("Project name")).not.toBeInTheDocument();
  });

  function setup(input: { value: string | null; withNewProject?: boolean; unavailableProjectId?: string }) {
    const onChange = vi.fn();
    const onNameChange = vi.fn();
    const projects = [project("storefront", 3), project("marketing"), { ...project("checkout"), deploymentSummary: { activeCount: undefined, preview: [] } }];

    render(
      <ProjectPicker
        projects={projects}
        value={input.value}
        onChange={onChange}
        newProject={input.withNewProject ? { name: "", onNameChange, takenSlugs: [] } : undefined}
        unavailableProjectId={input.unavailableProjectId}
      />
    );

    return { onChange, onNameChange };
  }

  function project(name: string, activeCount?: number): Project {
    return {
      id: name,
      name,
      slug: name,
      description: null,
      isDefault: false,
      createdAt: "2026-01-01T12:00:00.000Z",
      createdBy: null,
      deploymentSummary: activeCount === undefined ? undefined : { activeCount, preview: [] }
    };
  }
});
