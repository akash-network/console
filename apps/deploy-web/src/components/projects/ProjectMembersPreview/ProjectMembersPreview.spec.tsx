import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationMemberOutput } from "@src/types/organizationMembership";
import type { ProjectMember, ProjectRole } from "@src/types/project";
import type { DEPENDENCIES } from "./ProjectMembersPreview";
import { MAX_PREVIEWED_MEMBERS, ProjectMembersPreview } from "./ProjectMembersPreview";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ProjectMembersPreview.name, () => {
  it("lists the members granted the project with their project role", () => {
    const { useProjectMembersQuery } = setup({ members: [member("1", "jane", "admin"), member("2", null, "viewer")] });

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual(["JjaneAdmin", "STsam@acme.testViewer"]);
    expect(screen.getByText("2 members")).toBeInTheDocument();
    expect(useProjectMembersQuery).toHaveBeenCalledWith("project-1");
  });

  it("lists everyone on every project after the grants, owners first, tagged and counted without a role", () => {
    const { useOrganizationMembersQuery } = setup({
      members: [member("1", "jane", "admin")],
      organizationMembers: [
        organizationMember("frank", "member", "all"),
        organizationMember("ada", "admin"),
        organizationMember(null, "viewer", "all"),
        organizationMember("olga", "owner"),
        organizationMember("dave", "member", "selected")
      ]
    });

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual([
      "JjaneAdmin",
      "OolgaAll projects",
      "AadaAll projects",
      "FfrankAll projects",
      "STsam@acme.testAll projects"
    ]);
    expect(screen.getByText("5 members")).toBeInTheDocument();
    expect(useOrganizationMembersQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("lists someone on every project who also holds a grant with the grant only", () => {
    setup({ members: [member("frank", "frank", "viewer")], organizationMembers: [organizationMember("frank", "member", "all")] });

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual(["FfrankViewer"]);
  });

  it("previews the members on every project within the same few", () => {
    setup({
      members: Array.from({ length: MAX_PREVIEWED_MEMBERS - 1 }, (_, index) => member(String(index), `user${index}`, "member")),
      organizationMembers: [organizationMember("frank", "member", "all"), organizationMember("grace", "viewer", "all")]
    });

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows).toHaveLength(MAX_PREVIEWED_MEMBERS);
    expect(rows[MAX_PREVIEWED_MEMBERS - 1]).toHaveTextContent("frank");
    expect(screen.getByText("and 1 more")).toBeInTheDocument();
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

  it("says the members could not be loaded when the organization's members fail to load", () => {
    setup({ members: [member("1", "jane", "admin")], isOrganizationMembersError: true });

    expect(screen.getByText("Couldn't load the members.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows placeholders instead of an empty project while the members load", () => {
    setup({ members: [], isLoading: true });

    expect(screen.getByRole("status", { name: "Loading the members" })).toBeInTheDocument();
    expect(screen.queryByText("No one has been granted this project yet.")).not.toBeInTheDocument();
    expect(screen.queryByText("0 members")).not.toBeInTheDocument();
  });

  it("shows placeholders while the organization's members load", () => {
    setup({ members: [member("1", "jane", "admin")], isLoadingOrganizationMembers: true });

    expect(screen.getByRole("status", { name: "Loading the members" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText("1 member")).not.toBeInTheDocument();
  });

  it("explains that owners and admins reach every project", () => {
    setup({ members: [] });

    expect(screen.getByText("Owners and admins can open every project.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("lets someone who manages the project's access open the access dialog, and close it again", async () => {
    const { canManageAccess, ProjectAccessDialog } = setup({ members: [], canManageAccess: true });

    expect(canManageAccess).toHaveBeenCalledWith("project-1");
    expect(ProjectAccessDialog).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Manage access" }));

    expect(ProjectAccessDialog.mock.lastCall?.[0]).toMatchObject({
      project: { id: "project-1", name: "storefront" },
      organizationName: "Acme Corp",
      viewerUserId: "user-me"
    });

    await userEvent.click(screen.getByRole("button", { name: "close access dialog" }));

    expect(screen.queryByRole("button", { name: "close access dialog" })).not.toBeInTheDocument();
  });

  it("offers no access management to anyone else", () => {
    setup({ members: [], canManageAccess: false });

    expect(screen.queryByRole("button", { name: "Manage access" })).not.toBeInTheDocument();
  });

  function setup(input: {
    members: ProjectMember[];
    organizationMembers?: OrganizationMemberOutput[];
    isLoading?: boolean;
    isError?: boolean;
    isLoadingOrganizationMembers?: boolean;
    isOrganizationMembersError?: boolean;
    canManageAccess?: boolean;
  }) {
    const useProjectMembersQuery = vi.fn<typeof DEPENDENCIES.useProjectMembersQuery>(() =>
      input.isLoading
        ? mock<ReturnType<typeof DEPENDENCIES.useProjectMembersQuery>>({ data: undefined, isLoading: true, isError: false })
        : input.isError
          ? mock<ReturnType<typeof DEPENDENCIES.useProjectMembersQuery>>({ data: undefined, isLoading: false, isError: true })
          : mock<ReturnType<typeof DEPENDENCIES.useProjectMembersQuery>>({ data: input.members, isLoading: false, isError: false })
    );
    const useOrganizationMembersQuery = vi.fn<typeof DEPENDENCIES.useOrganizationMembersQuery>(() =>
      input.isLoadingOrganizationMembers
        ? mock<ReturnType<typeof DEPENDENCIES.useOrganizationMembersQuery>>({ data: undefined, isLoading: true, isError: false })
        : input.isOrganizationMembersError
          ? mock<ReturnType<typeof DEPENDENCIES.useOrganizationMembersQuery>>({ data: undefined, isLoading: false, isError: true })
          : mock<ReturnType<typeof DEPENDENCIES.useOrganizationMembersQuery>>({ data: input.organizationMembers ?? [], isLoading: false, isError: false })
    );
    const canManageAccess = vi.fn(() => input.canManageAccess ?? false);
    const ProjectAccessDialog = vi.fn<typeof DEPENDENCIES.ProjectAccessDialog>(({ onClose }) => (
      <button type="button" onClick={onClose}>
        close access dialog
      </button>
    ));

    render(
      <ProjectMembersPreview
        project={{ id: "project-1", name: "storefront" }}
        organizationName="Acme Corp"
        dependencies={{
          useProjectMembersQuery,
          useOrganizationMembersQuery,
          useProjectAccess: () => mock<ReturnType<typeof DEPENDENCIES.useProjectAccess>>({ canManageAccess }),
          useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: { id: "user-me" } }),
          ProjectAccessDialog
        }}
      />
    );

    return { useProjectMembersQuery, useOrganizationMembersQuery, canManageAccess, ProjectAccessDialog };
  }

  function member(id: string, username: string | null, role: ProjectRole): ProjectMember {
    return { id, projectId: "project-1", userId: `user-${id}`, username, email: "sam@acme.test", role, createdAt: "2026-01-01T12:00:00.000Z" };
  }

  function organizationMember(
    username: string | null,
    role: OrganizationMemberOutput["role"],
    projectAccess: OrganizationMemberOutput["projectAccess"] = null
  ): OrganizationMemberOutput {
    return {
      id: `member-${username ?? "unnamed"}`,
      userId: `user-${username ?? "unnamed"}`,
      username,
      email: "sam@acme.test",
      role,
      projectAccess,
      projectCount: null,
      createdAt: "2026-01-01T12:00:00.000Z"
    };
  }
});
