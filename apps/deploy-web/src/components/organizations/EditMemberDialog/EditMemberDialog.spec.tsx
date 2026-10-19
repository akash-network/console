import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssignableRole } from "@src/components/organizations/organizationRoles";
import type { ProjectGrant } from "@src/components/organizations/ProjectGrantsField/ProjectGrantsField";
import type { OrganizationMemberOutput } from "@src/types/organizationMembership";
import type { Project } from "@src/types/project";
import type { DEPENDENCIES } from "./EditMemberDialog";
import { EditMemberDialog } from "./EditMemberDialog";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("EditMemberDialog", () => {
  it("introduces the edit and starts from the member's role", () => {
    setup({});

    expect(screen.getByRole("heading", { name: "Edit bob" })).toBeInTheDocument();
    expect(screen.getByText("Changes apply as soon as you save.")).toBeInTheDocument();
    expect(within(screen.getByRole("radiogroup", { name: "Role" })).getByRole("radio", { name: /Member/ })).toBeChecked();
    expect(screen.getAllByRole("radio").map(radio => radio.getAttribute("value"))).toEqual(["member", "viewer", "billing", "admin"]);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it.each([
    ["viewer", "Sees deployments and logs in the projects they can access, but can't change them."],
    ["billing", "Adds credits, manages payment methods and sees usage, but not deployments."]
  ] as const)("starts a %s from their own role among the same choices", (role, description) => {
    setup({ member: { role, projectAccess: role === "viewer" ? "all" : null } });

    expect(screen.getAllByRole("radio").map(radio => radio.getAttribute("value"))).toEqual(["member", "viewer", "billing", "admin"]);
    expect(screen.getByRole("radio", { name: new RegExp(description) })).toBeChecked();
  });

  it("keeps the projects of a member made a viewer", async () => {
    const { user, updateMember } = setup({});

    await user.click(screen.getByRole("radio", { name: /^Viewer/ }));

    expect(screen.getByText("selected: storefront as viewer")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateMember.mock.lastCall?.[0]).toEqual({
      id: "member-bob",
      data: { role: "viewer", projectAccess: "selected", projectGrants: [STOREFRONT_GRANT] }
    });
  });

  it("asks for the project access of a billing member made a viewer", async () => {
    const { user, updateMember, ProjectAccessField, useOrganizationMemberProjectGrantsQuery } = setup({
      member: { role: "billing", projectAccess: null },
      grants: undefined
    });

    expect(useOrganizationMemberProjectGrantsQuery).toHaveBeenCalledWith("member-bob", { enabled: false });
    expect(ProjectAccessField).not.toHaveBeenCalled();

    await user.click(screen.getByRole("radio", { name: /^Viewer/ }));

    expect(screen.getByText("all: no project picked")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "grant billing-api" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateMember.mock.lastCall?.[0]).toEqual({
      id: "member-bob",
      data: { role: "viewer", projectAccess: "selected", projectGrants: [{ projectId: "billing-api", role: "member" }] }
    });
  });

  it("starts a member on specific projects from the grants they hold", () => {
    const { ProjectAccessField, useOrganizationMemberProjectGrantsQuery } = setup({});

    expect(useOrganizationMemberProjectGrantsQuery).toHaveBeenCalledWith("member-bob", { enabled: true });
    expect(screen.getByText("selected: storefront as viewer")).toBeInTheDocument();
    expect(ProjectAccessField.mock.lastCall?.[0].organizationName).toBe("Acme Corp");
    expect(ProjectAccessField.mock.lastCall?.[0].projects.map(project => project.id)).toEqual(["storefront", "billing-api"]);
  });

  it("starts a member on every project when that is what they hold", () => {
    setup({ member: { projectAccess: "all" }, grants: [] });

    expect(screen.getByText("all: no project picked")).toBeInTheDocument();
  });

  it("does not load the grants of an admin, who opens every project", () => {
    const { ProjectAccessField, useOrganizationMemberProjectGrantsQuery } = setup({ member: { role: "admin", projectAccess: "all" }, grants: undefined });

    expect(useOrganizationMemberProjectGrantsQuery).toHaveBeenCalledWith("member-bob", { enabled: false });
    expect(ProjectAccessField).not.toHaveBeenCalled();
  });

  it("gives every project to an admin moved down to member", async () => {
    const { user, updateMember } = setup({ member: { role: "admin", projectAccess: "all" }, grants: undefined });

    await user.click(screen.getByRole("radio", { name: /Member/ }));

    expect(screen.getByText("all: no project picked")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateMember.mock.lastCall?.[0]).toEqual({ id: "member-bob", data: { role: "member", projectAccess: "all" } });
  });

  it("sends the specific projects picked for a member", async () => {
    const { user, updateMember } = setup({ member: { projectAccess: "all" }, grants: [] });

    await user.click(screen.getByRole("button", { name: "grant billing-api" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateMember.mock.lastCall?.[0]).toEqual({
      id: "member-bob",
      data: { role: "member", projectAccess: "selected", projectGrants: [{ projectId: "billing-api", role: "member" }] }
    });
  });

  it("has nothing to save once the role is changed back", async () => {
    const { user, updateMember } = setup({});

    await user.click(screen.getByRole("radio", { name: /Admin/ }));
    await user.click(screen.getByRole("radio", { name: /Member/ }));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(updateMember).not.toHaveBeenCalled();
  });

  it("has nothing to save once the access is changed back", async () => {
    const { user } = setup({});

    await user.click(screen.getByRole("button", { name: "open every project" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "keep storefront" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("has nothing to save when a member on every project is given every project again", async () => {
    const { user } = setup({ member: { projectAccess: "all" }, grants: [] });

    await user.click(screen.getByRole("button", { name: "open every project" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it.each([
    ["Admin", "admin"],
    ["Billing", "billing"]
  ])("sends only the role of a member made %s", async (label, role) => {
    const { user, updateMember } = setup({});

    await user.click(screen.getByRole("radio", { name: new RegExp(`^${label}`) }));

    expect(screen.queryByText("selected: storefront as viewer")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateMember.mock.lastCall?.[0]).toEqual({ id: "member-bob", data: { role } });
  });

  it("holds the save back while a member on specific projects has none picked", async () => {
    const { user, updateMember } = setup({});

    await user.click(screen.getByRole("button", { name: "pick no project" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(updateMember).not.toHaveBeenCalled();
  });

  it("holds the project access back until the member's grants are loaded", async () => {
    const { user, ProjectAccessField } = setup({ member: { role: "viewer" }, grants: undefined });

    await user.click(screen.getByRole("radio", { name: /Member/ }));

    expect(ProjectAccessField).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("explains that the member's grants could not be loaded", async () => {
    const { user, ProjectAccessField } = setup({ grants: undefined, isGrantsError: true });

    await user.click(screen.getByRole("radio", { name: /Admin/ }));
    await user.click(screen.getByRole("radio", { name: /Member/ }));

    expect(screen.getByText("Couldn't load bob's projects. Try again later.")).toBeInTheDocument();
    expect(ProjectAccessField).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("sets a failed grants read aside once the member is made an admin", async () => {
    const { user } = setup({ grants: undefined, isGrantsError: true });

    await user.click(screen.getByRole("radio", { name: /Admin/ }));

    expect(screen.queryByText("Couldn't load bob's projects. Try again later.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("confirms the save and closes", async () => {
    const { user, updateMember, enqueueSnackbar, onClose } = setup({});
    updateMember.mockImplementation((input, options) => options?.onSuccess?.({ data: { ...BOB, role: "admin" } }, input, undefined));

    await user.click(screen.getByRole("radio", { name: /Admin/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Saved bob's role and access", variant: "success" });
    expect(onClose).toHaveBeenCalled();
  });

  it("explains a refusal with the API's reason and stays open", async () => {
    const { user, updateMember, enqueueSnackbar, onClose } = setup({});
    updateMember.mockImplementation((input, options) => options?.onError?.(new ApiError(403, { code: "owner_role_restricted" }, "PATCH"), input, undefined));

    await user.click(screen.getByRole("radio", { name: /Admin/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Only the owner can change the owner's role or hand over ownership.", variant: "error" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the save fails for another reason", async () => {
    const { user, updateMember, enqueueSnackbar } = setup({});
    updateMember.mockImplementation((input, options) => options?.onError?.(new Error("boom"), input, undefined));

    await user.click(screen.getByRole("radio", { name: /Admin/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Couldn't save bob's changes", variant: "error" });
  });

  it("closes when cancelled, from its close button and with Escape", async () => {
    const { user, onClose } = setup({});

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("stays open while the change is being saved", async () => {
    const { user, onClose } = setup({ isPending: true });

    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  function lastSnackbar(enqueueSnackbar: ReturnType<typeof vi.fn>) {
    const [element, options] = enqueueSnackbar.mock.lastCall as [{ props: { title: string } }, { variant: string }];
    return { title: element.props.title, variant: options.variant };
  }

  function setup(input: {
    member?: Partial<OrganizationMemberOutput> & { role?: AssignableRole };
    grants?: ProjectGrant[] | undefined;
    isGrantsError?: boolean;
    isPending?: boolean;
  }) {
    const updateMember = vi.fn<ReturnType<typeof DEPENDENCIES.useUpdateOrganizationMemberMutation>["mutate"]>();
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();
    const grants = "grants" in input ? input.grants : [STOREFRONT_GRANT];
    const useOrganizationMemberProjectGrantsQuery = vi.fn<typeof DEPENDENCIES.useOrganizationMemberProjectGrantsQuery>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useOrganizationMemberProjectGrantsQuery>>({ isError: input.isGrantsError ?? false }), { data: grants })
    );
    const ProjectAccessField = vi.fn<typeof DEPENDENCIES.ProjectAccessField>(({ value, onChange }) => (
      <>
        <p>
          {value.access}: {value.grants.map(grant => `${grant.projectId} as ${grant.role}`).join(", ") || "no project picked"}
        </p>
        <button type="button" onClick={() => onChange({ access: "selected", grants: [{ projectId: "billing-api", role: "member" }] })}>
          grant billing-api
        </button>
        <button type="button" onClick={() => onChange({ access: "selected", grants: [] })}>
          pick no project
        </button>
        <button type="button" onClick={() => onChange({ access: "selected", grants: [{ projectId: "storefront", role: "viewer" }] })}>
          keep storefront
        </button>
        <button type="button" onClick={() => onChange({ access: "all", grants: [{ projectId: "storefront", role: "viewer" }] })}>
          open every project
        </button>
      </>
    ));

    const dependencies: typeof DEPENDENCIES = {
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useUpdateOrganizationMemberMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useUpdateOrganizationMemberMutation>>({ mutate: updateMember, isPending: input.isPending ?? false }),
      useOrganizationMemberProjectGrantsQuery,
      useProjectsQuery: () =>
        mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({
          data: [mock<Project>({ id: "storefront", name: "storefront" }), mock<Project>({ id: "billing-api", name: "billing-api" })]
        }),
      ProjectAccessField
    };

    render(<EditMemberDialog member={{ ...BOB, ...input.member }} organizationName="Acme Corp" onClose={onClose} dependencies={dependencies} />);

    return { user: userEvent.setup(), updateMember, enqueueSnackbar, onClose, ProjectAccessField, useOrganizationMemberProjectGrantsQuery };
  }
});

const STOREFRONT_GRANT: ProjectGrant = { projectId: "storefront", role: "viewer" };

const BOB: OrganizationMemberOutput & { role: AssignableRole } = {
  id: "member-bob",
  userId: "user-bob",
  username: "bob",
  email: "bob@acme.io",
  role: "member",
  projectAccess: "selected",
  projectCount: 1,
  createdAt: "2026-02-01T00:00:00Z"
};
