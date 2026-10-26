import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationMemberOutput } from "@src/types/organizationMembership";
import type { ProjectMember } from "@src/types/project";
import type { DEPENDENCIES } from "./ProjectAccessDialog";
import { ProjectAccessDialog } from "./ProjectAccessDialog";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ProjectAccessDialog.name, () => {
  it("says owners and admins open every project without being added", () => {
    setup({});

    expect(screen.getByRole("heading", { name: "Access to storefront" })).toBeInTheDocument();
    expect(screen.getByText("Owners and admins of Acme Corp open every project without being added here.")).toBeInTheDocument();
  });

  it("lists who was given access with their project role", () => {
    setup({ organizationMembers: [BOB, CAROL] });

    const rows = within(screen.getByRole("list", { name: "People with access" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("bob")).toBeInTheDocument();
    expect(within(rows[0]).getByText("bob@acme.io")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("combobox", { name: "Role for bob" })).toHaveTextContent("Member");
    expect(within(rows[1]).getByRole("combobox", { name: "Role for carol@acme.io" })).toHaveTextContent("Viewer");
    expect(screen.getByText("2 people")).toBeInTheDocument();
  });

  it("lists everyone on every project after the grants, owners first, without a role, and counts them", () => {
    setup({ organizationMembers: [FRANK_ON_ALL_PROJECTS, ADMIN, BOB, GRACE_ON_ALL_PROJECTS, OWNER, BILLING, DAVE, CAROL] });

    const rows = within(screen.getByRole("list", { name: "People with access" })).getAllByRole("listitem");
    expect(rows.slice(2).map(row => row.textContent)).toEqual([
      "OownerYouAll projectsowner@acme.io",
      "AadminAll projectsadmin@acme.io",
      "FfrankAll projectsfrank@acme.io",
      "GgraceAll projectsgrace@acme.io"
    ]);
    expect(rows.slice(2).flatMap(row => within(row).queryAllByRole("combobox"))).toEqual([]);
    expect(screen.getByText("6 people")).toBeInTheDocument();
  });

  it("lists the people on every project of a project no one was given", () => {
    setup({ grants: [], organizationMembers: [FRANK_ON_ALL_PROJECTS, DAVE] });

    expect(within(screen.getByRole("list", { name: "People with access" })).getByText("frank")).toBeInTheDocument();
    expect(screen.getByText("1 person")).toBeInTheDocument();
    expect(screen.queryByText("No one has been given access to this project yet.")).not.toBeInTheDocument();
  });

  it("lists an admin who still holds a grant with the grant only", () => {
    setup({ grants: [{ ...BOB_GRANT, userId: "user-admin", username: "admin" }], organizationMembers: [ADMIN] });

    const rows = within(screen.getByRole("list", { name: "People with access" })).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByRole("combobox", { name: "Role for admin" })).toBeInTheDocument();
  });

  it("lets an owner or admin edit the members on every project, and comes back to the access list after", async () => {
    const { user, EditMemberDialog } = setup({
      viewerUserId: "user-admin",
      grants: [BOB_GRANT],
      organizationMembers: [OWNER, ADMIN, FRANK_ON_ALL_PROJECTS, BOB]
    });

    const rows = within(screen.getByRole("list", { name: "People with access" })).getAllByRole("listitem");
    expect(within(rows[1]).queryByRole("button", { name: "Edit owner" })).not.toBeInTheDocument();
    expect(within(rows[2]).queryByRole("button", { name: "Edit admin" })).not.toBeInTheDocument();

    await user.click(within(rows[3]).getByRole("button", { name: "Edit frank" }));

    expect(EditMemberDialog.mock.lastCall?.[0]).toMatchObject({ member: FRANK_ON_ALL_PROJECTS, organizationName: "Acme Corp" });
    expect(screen.queryByRole("heading", { name: "Access to storefront" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "close member editor" }));

    expect(screen.getByRole("heading", { name: "Access to storefront" })).toBeInTheDocument();
  });

  it("lets an owner edit an admin", async () => {
    const { user, EditMemberDialog } = setup({ organizationMembers: [OWNER, ADMIN] });

    await user.click(screen.getByRole("button", { name: "Edit admin" }));

    expect(EditMemberDialog.mock.lastCall?.[0]).toMatchObject({ member: ADMIN });
  });

  it("offers no member editing to a project admin who does not manage the organization's members", () => {
    setup({ viewerUserId: "user-bob", organizationMembers: [OWNER, ADMIN, FRANK_ON_ALL_PROJECTS, BOB] });

    expect(screen.queryByRole("button", { name: /^Edit / })).not.toBeInTheDocument();
  });

  it("counts a single person in the singular", () => {
    setup({ grants: [BOB_GRANT], organizationMembers: [BOB] });

    expect(screen.getByText("1 person")).toBeInTheDocument();
  });

  it("says when no one was given access yet", () => {
    setup({ grants: [], organizationMembers: [BOB, DAVE] });

    expect(screen.getByText("No one has been given access to this project yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "People with access" })).not.toBeInTheDocument();
  });

  it("shows the caller's own grant without the controls to change it", () => {
    setup({ viewerUserId: "user-bob" });

    const ownRow = within(screen.getByRole("list", { name: "People with access" })).getAllByRole("listitem")[0];
    expect(within(ownRow).getByText("You")).toBeInTheDocument();
    expect(within(ownRow).getByText("Member")).toBeInTheDocument();
    expect(within(ownRow).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(ownRow).queryByRole("button", { name: /Revoke/ })).not.toBeInTheDocument();
  });

  it("offers only members and viewers who have no access yet, and never the caller", async () => {
    const { user } = setup({ viewerUserId: "user-erin" });

    await user.click(screen.getByRole("combobox", { name: "Give access to" }));

    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["dave"]);
  });

  it("leaves out the members on every project, who need no grant", async () => {
    const { user } = setup({ organizationMembers: [OWNER, BOB, { ...DAVE, projectAccess: "all", projectCount: null }, ERIN] });

    await user.click(screen.getByRole("combobox", { name: "Give access to" }));

    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["erin"]);
  });

  it("gives the chosen member access with the chosen role and confirms it", async () => {
    const { user, createGrant, enqueueSnackbar } = setup({});
    createGrant.mockImplementation((input, options) => options?.onSuccess?.({ data: BOB_GRANT }, input, undefined));

    expect(screen.getByRole("button", { name: "Give access" })).toBeDisabled();
    expect(screen.getByText("Member: Also deploys into the project and manages its deployments.")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Give access to" }));
    await user.click(screen.getByRole("option", { name: "dave" }));
    await user.click(screen.getByRole("combobox", { name: "Role for the new member" }));
    await user.click(screen.getByRole("option", { name: "Admin" }));
    await user.click(screen.getByRole("button", { name: "Give access" }));

    expect(createGrant.mock.lastCall?.[0]).toEqual({ data: { projectId: "project-1", userId: "user-dave", role: "admin" } });
    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "dave can now open storefront", variant: "success" });
    expect(screen.getByRole("combobox", { name: "Role for the new member" })).toHaveTextContent("Member");
    expect(screen.getByRole("button", { name: "Give access" })).toBeDisabled();
  });

  it("explains a grant the API refused with its reason", async () => {
    const { user, createGrant, enqueueSnackbar } = setup({});
    createGrant.mockImplementation((input, options) => options?.onError?.(new ApiError(409, { code: "already_granted" }, "POST"), input, undefined));

    await chooseDave(user);
    await user.click(screen.getByRole("button", { name: "Give access" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "They already have access to this project.", variant: "error" });
  });

  it("falls back to a generic message when a grant fails for another reason", async () => {
    const { user, createGrant, enqueueSnackbar } = setup({});
    createGrant.mockImplementation((input, options) => options?.onError?.(new Error("boom"), input, undefined));

    await chooseDave(user);
    await user.click(screen.getByRole("button", { name: "Give access" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Couldn't give dave access", variant: "error" });
  });

  it("holds the grant button while a grant is on its way", async () => {
    const { user } = setup({ isGranting: true });

    await chooseDave(user);

    expect(screen.getByRole("button", { name: /Give access/ })).toBeDisabled();
  });

  it("says when everyone who can be given access already has it", () => {
    setup({ organizationMembers: [OWNER, BOB] });

    expect(screen.getByText("Every member and viewer of Acme Corp already has access to this project.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Give access" })).not.toBeInTheDocument();
  });

  it("changes someone's project role and confirms it", async () => {
    const { user, updateGrant, enqueueSnackbar } = setup({});
    updateGrant.mockImplementation((input, options) => options?.onSuccess?.({ data: { ...BOB_GRANT, role: "viewer" } }, input, undefined));

    await user.click(screen.getByRole("combobox", { name: "Role for bob" }));
    await user.click(screen.getByRole("option", { name: "Viewer" }));

    expect(updateGrant.mock.lastCall?.[0]).toEqual({ id: "grant-bob", data: { role: "viewer" } });
    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "bob is now a Viewer of storefront", variant: "success" });
  });

  it("leaves a role alone when the same one is picked again", async () => {
    const { user, updateGrant } = setup({});

    await user.click(screen.getByRole("combobox", { name: "Role for bob" }));
    await user.click(screen.getByRole("option", { name: "Member" }));

    expect(updateGrant).not.toHaveBeenCalled();
  });

  it("explains a role change the API refused", async () => {
    const { user, updateGrant, enqueueSnackbar } = setup({});
    updateGrant.mockImplementation((input, options) => options?.onError?.(new ApiError(403, { code: "forbidden" }, "PATCH"), input, undefined));

    await user.click(screen.getByRole("combobox", { name: "Role for bob" }));
    await user.click(screen.getByRole("option", { name: "Admin" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "You can't manage access to this project.", variant: "error" });
  });

  it("falls back to a generic message when a role change fails for another reason", async () => {
    const { user, updateGrant, enqueueSnackbar } = setup({});
    updateGrant.mockImplementation((input, options) => options?.onError?.(new Error("boom"), input, undefined));

    await user.click(screen.getByRole("combobox", { name: "Role for bob" }));
    await user.click(screen.getByRole("option", { name: "Admin" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Couldn't change bob's access", variant: "error" });
  });

  it("revokes someone's access once the revocation is confirmed", async () => {
    const { user, confirm, deleteGrant, enqueueSnackbar } = setup({});
    deleteGrant.mockImplementation((input, options) => options?.onSuccess?.(undefined, input, undefined));

    await user.click(screen.getByRole("button", { name: "Revoke access for bob" }));

    expect(confirm).toHaveBeenCalledWith({
      title: "Revoke bob's access?",
      message: "bob can no longer open storefront, starting right away. Its deployments keep running."
    });
    expect(deleteGrant.mock.lastCall?.[0]).toEqual({ id: "grant-bob" });
    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "bob no longer has access to storefront", variant: "success" });
  });

  it("keeps someone's access when the revocation is not confirmed", async () => {
    const { user, deleteGrant } = setup({ isConfirmed: false });

    await user.click(screen.getByRole("button", { name: "Revoke access for bob" }));

    expect(deleteGrant).not.toHaveBeenCalled();
  });

  it("explains a revocation that failed", async () => {
    const { user, deleteGrant, enqueueSnackbar } = setup({});
    deleteGrant.mockImplementation((input, options) => options?.onError?.(new Error("boom"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Revoke access for bob" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Couldn't revoke bob's access", variant: "error" });
  });

  it("waits for the access list before offering anyone or counting anybody", () => {
    setup({ isLoadingGrants: true });

    expect(screen.getByLabelText("Loading people with access")).toBeInTheDocument();
    expect(screen.queryByText(/people$/)).not.toBeInTheDocument();
    expect(screen.queryByText("No one has been given access to this project yet.")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Give access to" })).toBeDisabled();
    expect(screen.queryByText(/already has access to this project/)).not.toBeInTheDocument();
  });

  it("waits for the organization's members before listing or counting anybody", () => {
    setup({ isLoadingOrganizationMembers: true });

    expect(screen.getByLabelText("Loading people with access")).toBeInTheDocument();
    expect(screen.queryByText(/people$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "People with access" })).not.toBeInTheDocument();
  });

  it("gives an organization viewer only view access and says why", async () => {
    const { user, createGrant } = setup({});

    await user.click(screen.getByRole("combobox", { name: "Give access to" }));
    await user.click(screen.getByRole("option", { name: "erin" }));

    expect(screen.getByText("Viewers of Acme Corp only view projects, whatever role they are given.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Role for the new member" })).toHaveTextContent("Viewer");

    await user.click(screen.getByRole("combobox", { name: "Role for the new member" }));
    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Viewer"]);
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Give access" }));

    expect(createGrant.mock.lastCall?.[0]).toEqual({ data: { projectId: "project-1", userId: "user-erin", role: "viewer" } });
  });

  it("marks an organization viewer's grant as view only and offers no higher role", async () => {
    const { user } = setup({ grants: [{ ...BOB_GRANT, userId: "user-erin", username: "erin", email: "erin@acme.io", role: "admin" }] });

    const row = within(screen.getByRole("list", { name: "People with access" })).getAllByRole("listitem")[0];
    expect(within(row).getByText("View only")).toBeInTheDocument();

    await user.click(within(row).getByRole("combobox", { name: "Role for erin" }));

    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Viewer", "Admin"]);
  });

  it("offers every role for a member's grant", async () => {
    const { user } = setup({});

    await user.click(screen.getByRole("combobox", { name: "Role for bob" }));

    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Viewer", "Member", "Admin"]);
  });

  it("closes when done", async () => {
    const { user, onClose } = setup({});

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("closes with Escape", async () => {
    const { user, onClose } = setup({});

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  async function chooseDave(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("combobox", { name: "Give access to" }));
    await user.click(screen.getByRole("option", { name: "dave" }));
  }

  function lastSnackbar(enqueueSnackbar: ReturnType<typeof vi.fn>) {
    const [element, options] = enqueueSnackbar.mock.lastCall as [{ props: { title: string } }, { variant: string }];
    return { title: element.props.title, variant: options.variant };
  }

  function setup(input: {
    grants?: ProjectMember[];
    organizationMembers?: OrganizationMemberOutput[];
    viewerUserId?: string;
    isConfirmed?: boolean;
    isGranting?: boolean;
    isLoadingGrants?: boolean;
    isLoadingOrganizationMembers?: boolean;
  }) {
    const createGrant = vi.fn<ReturnType<typeof DEPENDENCIES.useCreateProjectMemberMutation>["mutate"]>();
    const updateGrant = vi.fn<ReturnType<typeof DEPENDENCIES.useUpdateProjectMemberMutation>["mutate"]>();
    const deleteGrant = vi.fn<ReturnType<typeof DEPENDENCIES.useDeleteProjectMemberMutation>["mutate"]>();
    const confirm = vi.fn(async () => input.isConfirmed ?? true);
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();
    const EditMemberDialog = vi.fn<typeof DEPENDENCIES.EditMemberDialog>(({ onClose: closeMemberEditor }) => (
      <button type="button" onClick={closeMemberEditor}>
        close member editor
      </button>
    ));

    const dependencies: typeof DEPENDENCIES = {
      usePopup: () => mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useProjectMembersQuery: () =>
        input.isLoadingGrants
          ? mock<ReturnType<typeof DEPENDENCIES.useProjectMembersQuery>>({ data: undefined, isLoading: true })
          : mock<ReturnType<typeof DEPENDENCIES.useProjectMembersQuery>>({ data: input.grants ?? [BOB_GRANT, CAROL_GRANT], isLoading: false }),
      useOrganizationMembersQuery: () =>
        input.isLoadingOrganizationMembers
          ? mock<ReturnType<typeof DEPENDENCIES.useOrganizationMembersQuery>>({ data: undefined, isLoading: true })
          : mock<ReturnType<typeof DEPENDENCIES.useOrganizationMembersQuery>>({
              data: input.organizationMembers ?? [OWNER, ADMIN, BILLING, BOB, DAVE, ERIN, CAROL],
              isLoading: false
            }),
      useCreateProjectMemberMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCreateProjectMemberMutation>>({ mutate: createGrant, isPending: input.isGranting ?? false }),
      useUpdateProjectMemberMutation: () => mock<ReturnType<typeof DEPENDENCIES.useUpdateProjectMemberMutation>>({ mutate: updateGrant }),
      useDeleteProjectMemberMutation: () => mock<ReturnType<typeof DEPENDENCIES.useDeleteProjectMemberMutation>>({ mutate: deleteGrant }),
      EditMemberDialog
    };

    render(
      <ProjectAccessDialog
        project={{ id: "project-1", name: "storefront" }}
        organizationName="Acme Corp"
        viewerUserId={input.viewerUserId ?? "user-owner"}
        onClose={onClose}
        dependencies={dependencies}
      />
    );

    return { user: userEvent.setup(), createGrant, updateGrant, deleteGrant, confirm, enqueueSnackbar, onClose, EditMemberDialog };
  }
});

const BOB_GRANT: ProjectMember = {
  id: "grant-bob",
  projectId: "project-1",
  userId: "user-bob",
  username: "bob",
  email: "bob@acme.io",
  role: "member",
  createdAt: "2026-01-01T00:00:00Z"
};

const CAROL_GRANT: ProjectMember = {
  id: "grant-carol",
  projectId: "project-1",
  userId: "user-carol",
  username: null,
  email: "carol@acme.io",
  role: "viewer",
  createdAt: "2026-01-02T00:00:00Z"
};

function organizationMember(name: string, role: OrganizationMemberOutput["role"]): OrganizationMemberOutput {
  return {
    id: `member-${name}`,
    userId: `user-${name}`,
    username: name,
    email: `${name}@acme.io`,
    role,
    projectAccess: "selected",
    projectCount: 1,
    createdAt: "2026-01-01T00:00:00Z"
  };
}

const OWNER = organizationMember("owner", "owner");
const ADMIN = organizationMember("admin", "admin");
const BILLING = organizationMember("billing", "billing");
const BOB = organizationMember("bob", "member");
const DAVE = organizationMember("dave", "member");
const ERIN = organizationMember("erin", "viewer");
const CAROL: OrganizationMemberOutput = { ...organizationMember("carol", "member"), userId: "user-carol", username: null };
const FRANK_ON_ALL_PROJECTS: OrganizationMemberOutput = { ...organizationMember("frank", "member"), projectAccess: "all", projectCount: null };
const GRACE_ON_ALL_PROJECTS: OrganizationMemberOutput = { ...organizationMember("grace", "viewer"), projectAccess: "all", projectCount: null };
