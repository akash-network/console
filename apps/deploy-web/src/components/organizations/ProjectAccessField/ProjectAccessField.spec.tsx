import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES, ProjectAccessValue } from "./ProjectAccessField";
import { hasProjectAccess, NO_PROJECT_PICKED_MESSAGE, ProjectAccessField, toProjectAccessRequest } from "./ProjectAccessField";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ProjectAccessField.name, () => {
  it("offers every project of the organization or specific ones", () => {
    setup({ value: { access: "all", grants: [] } });

    expect(screen.getByRole("radiogroup", { name: "Project access" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /All projects/ })).toBeChecked();
    expect(screen.getByText("Every project in Acme Corp, including new ones.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Specific projects/ })).not.toBeChecked();
    expect(screen.getByText("Only the projects you pick, each with its own role.")).toBeInTheDocument();
  });

  it("hides the project picker while every project is chosen", () => {
    const { ProjectGrantsField } = setup({ value: { access: "all", grants: [] } });

    expect(ProjectGrantsField).not.toHaveBeenCalled();
    expect(screen.queryByText(NO_PROJECT_PICKED_MESSAGE)).not.toBeInTheDocument();
  });

  it("switches to specific projects and keeps the projects picked before", async () => {
    const grants = [{ projectId: "storefront", role: "viewer" as const }];
    const { user, onChange } = setup({ value: { access: "all", grants } });

    await user.click(screen.getByRole("radio", { name: /Specific projects/ }));

    expect(onChange).toHaveBeenCalledWith({ access: "selected", grants });
  });

  it("switches back to every project", async () => {
    const { user, onChange } = setup({ value: { access: "selected", grants: [] } });

    await user.click(screen.getByRole("radio", { name: /All projects/ }));

    expect(onChange).toHaveBeenCalledWith({ access: "all", grants: [] });
  });

  it("asks for a project while specific projects are chosen and none is picked", () => {
    const { ProjectGrantsField } = setup({ value: { access: "selected", grants: [] } });

    expect(ProjectGrantsField.mock.lastCall?.[0]).toMatchObject({ projects: [{ id: "storefront", name: "storefront" }], grants: [] });
    expect(screen.getByText(NO_PROJECT_PICKED_MESSAGE)).toBeInTheDocument();
  });

  it("passes the projects picked on and stops asking for one", async () => {
    const { user, onChange } = setup({ value: { access: "selected", grants: [{ projectId: "storefront", role: "member" }] } });

    await user.click(screen.getByRole("button", { name: "grant storefront" }));

    expect(screen.queryByText(NO_PROJECT_PICKED_MESSAGE)).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({ access: "selected", grants: [{ projectId: "storefront", role: "viewer" }] });
  });

  describe(hasProjectAccess.name, () => {
    it.each([
      [{ access: "all", grants: [] }, true],
      [{ access: "selected", grants: [{ projectId: "storefront", role: "member" }] }, true],
      [{ access: "selected", grants: [] }, false]
    ] satisfies [ProjectAccessValue, boolean][])("tells whether %o reaches any project", (value, expected) => {
      expect(hasProjectAccess(value)).toBe(expected);
    });
  });

  describe(toProjectAccessRequest.name, () => {
    it("sends no grants for every project", () => {
      expect(toProjectAccessRequest({ access: "all", grants: [{ projectId: "storefront", role: "member" }] })).toEqual({ projectAccess: "all" });
    });

    it("sends the grants picked for specific projects", () => {
      const grants = [{ projectId: "storefront", role: "admin" as const }];

      expect(toProjectAccessRequest({ access: "selected", grants })).toEqual({ projectAccess: "selected", projectGrants: grants });
    });
  });

  function setup(input: { value: ProjectAccessValue }) {
    const onChange = vi.fn();
    const ProjectGrantsField = vi.fn<typeof DEPENDENCIES.ProjectGrantsField>(({ onChange }) => (
      <button type="button" onClick={() => onChange([{ projectId: "storefront", role: "viewer" }])}>
        grant storefront
      </button>
    ));

    render(
      <ProjectAccessField
        organizationName="Acme Corp"
        projects={[{ id: "storefront", name: "storefront" }]}
        value={input.value}
        onChange={onChange}
        dependencies={{ ProjectGrantsField }}
      />
    );

    return { user: userEvent.setup(), onChange, ProjectGrantsField };
  }
});
