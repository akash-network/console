import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProjectMember, ProjectRole } from "@src/types/project";
import type { DEPENDENCIES } from "./ProjectMembersPreview";
import { MAX_PREVIEWED_MEMBERS, ProjectMembersPreview } from "./ProjectMembersPreview";

import { render, screen, within } from "@testing-library/react";

describe(ProjectMembersPreview.name, () => {
  it("lists the members granted the project with their project role", () => {
    const { useProjectMembersQuery } = setup({ members: [member("1", "jane", "admin"), member("2", null, "viewer")] });

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual(["JjaneAdmin", "STsam@acme.testViewer"]);
    expect(screen.getByText("2 members")).toBeInTheDocument();
    expect(useProjectMembersQuery).toHaveBeenCalledWith("project-1");
  });

  it("names the role of a plain member", () => {
    setup({ members: [member("1", "jane", "member")] });

    expect(screen.getByText("Member")).toBeInTheDocument();
    expect(screen.getByText("1 member")).toBeInTheDocument();
  });

  it("says when nobody was granted the project yet", () => {
    setup({ members: [] });

    expect(screen.getByText("No one has been granted this project yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("previews a few members and counts the rest", () => {
    setup({ members: Array.from({ length: MAX_PREVIEWED_MEMBERS + 2 }, (_, index) => member(String(index), `user${index}`, "member")) });

    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(MAX_PREVIEWED_MEMBERS);
    expect(screen.getByText("and 2 more")).toBeInTheDocument();
  });

  it("counts no hidden members when all of them fit", () => {
    setup({ members: Array.from({ length: MAX_PREVIEWED_MEMBERS }, (_, index) => member(String(index), `user${index}`, "member")) });

    expect(screen.queryByText(/more$/)).not.toBeInTheDocument();
  });

  it("says the members could not be loaded", () => {
    setup({ members: [], isError: true });

    expect(screen.getByText("Couldn't load the members.")).toBeInTheDocument();
    expect(screen.queryByText("No one has been granted this project yet.")).not.toBeInTheDocument();
  });

  it("shows placeholders instead of an empty project while the members load", () => {
    setup({ members: [], isLoading: true });

    expect(screen.getByRole("status", { name: "Loading the members" })).toBeInTheDocument();
    expect(screen.queryByText("No one has been granted this project yet.")).not.toBeInTheDocument();
    expect(screen.queryByText("0 members")).not.toBeInTheDocument();
  });

  it("explains that owners and admins reach every project", () => {
    setup({ members: [] });

    expect(screen.getByText("Owners and admins can open every project.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  function setup(input: { members: ProjectMember[]; isLoading?: boolean; isError?: boolean }) {
    const useProjectMembersQuery = vi.fn<typeof DEPENDENCIES.useProjectMembersQuery>(() =>
      input.isLoading
        ? mock<ReturnType<typeof DEPENDENCIES.useProjectMembersQuery>>({ data: undefined, isLoading: true, isError: false })
        : input.isError
          ? mock<ReturnType<typeof DEPENDENCIES.useProjectMembersQuery>>({ data: undefined, isLoading: false, isError: true })
          : mock<ReturnType<typeof DEPENDENCIES.useProjectMembersQuery>>({ data: input.members, isLoading: false, isError: false })
    );

    render(<ProjectMembersPreview projectId="project-1" dependencies={{ useProjectMembersQuery }} />);

    return { useProjectMembersQuery };
  }

  function member(id: string, username: string | null, role: ProjectRole): ProjectMember {
    return { id, projectId: "project-1", userId: `user-${id}`, username, email: "sam@acme.test", role, createdAt: "2026-01-01T12:00:00.000Z" };
  }
});
