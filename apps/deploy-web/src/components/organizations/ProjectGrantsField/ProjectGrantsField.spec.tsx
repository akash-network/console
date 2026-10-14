import { describe, expect, it, vi } from "vitest";

import type { ProjectGrant } from "./ProjectGrantsField";
import { ProjectGrantsField } from "./ProjectGrantsField";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ProjectGrantsField.name, () => {
  it("starts with no project and offers every project to add", async () => {
    const { user } = setup({ grants: [] });

    expect(screen.getByText("(optional)")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Add a project" }));

    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["storefront", "marketing"]);
  });

  it("adds a project as a member", async () => {
    const { user, onChange } = setup({ grants: [] });

    await user.click(screen.getByRole("combobox", { name: "Add a project" }));
    await user.click(screen.getByRole("option", { name: "marketing" }));

    expect(onChange).toHaveBeenCalledWith([{ projectId: "marketing", role: "member" }]);
  });

  it("lists the projects added, with their roles, and offers only the rest", async () => {
    const { user } = setup({ grants: [{ projectId: "storefront", role: "viewer" }] });

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("storefront")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("combobox", { name: "Role in storefront" })).toHaveTextContent("Viewer");

    await user.click(screen.getByRole("combobox", { name: "Add a project" }));

    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["marketing"]);
  });

  it("changes the role of one project only", async () => {
    const { user, onChange } = setup({
      grants: [
        { projectId: "storefront", role: "viewer" },
        { projectId: "marketing", role: "member" }
      ]
    });

    await user.click(screen.getByRole("combobox", { name: "Role in storefront" }));
    await user.click(screen.getByRole("option", { name: "Admin" }));

    expect(onChange).toHaveBeenCalledWith([
      { projectId: "storefront", role: "admin" },
      { projectId: "marketing", role: "member" }
    ]);
  });

  it("removes a project", async () => {
    const { user, onChange } = setup({
      grants: [
        { projectId: "storefront", role: "viewer" },
        { projectId: "marketing", role: "member" }
      ]
    });

    await user.click(screen.getByRole("button", { name: "Remove storefront" }));

    expect(onChange).toHaveBeenCalledWith([{ projectId: "marketing", role: "member" }]);
  });

  it("offers nothing more to add once every project was added", () => {
    setup({
      grants: [
        { projectId: "storefront", role: "viewer" },
        { projectId: "marketing", role: "member" }
      ]
    });

    expect(screen.queryByRole("combobox", { name: "Add a project" })).not.toBeInTheDocument();
  });

  it("names a project that is no longer listed by its id", () => {
    setup({ grants: [{ projectId: "deleted-project", role: "member" }] });

    expect(screen.getByText("deleted-project")).toBeInTheDocument();
  });

  function setup(input: { grants: ProjectGrant[] }) {
    const onChange = vi.fn();

    render(
      <ProjectGrantsField
        projects={[
          { id: "storefront", name: "storefront" },
          { id: "marketing", name: "marketing" }
        ]}
        grants={input.grants}
        onChange={onChange}
      />
    );

    return { user: userEvent.setup(), onChange };
  }
});
