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
    setup({});

    const rows = within(screen.getByRole("list", { name: "People with access" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("bob")).toBeInTheDocument();
    expect(within(rows[0]).getByText("bob@acme.io")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("combobox", { name: "Role for bob" })).toHaveTextContent("Member");
    expect(within(rows[1]).getByRole("combobox", { name: "Role for carol@acme.io" })).toHaveTextContent("Viewer");
    expect(screen.getByText("2 people")).toBeInTheDocument();
  });

  it("counts a single person in the singular", () => {
    setup({ grants: [BOB_GRANT] });

    expect(screen.getByText("1 person")).toBeInTheDocument();
  });

  it("says when no one was given access yet", () => {
    setup({ grants: [] });

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
  }) {
    const createGrant = vi.fn<ReturnType<typeof DEPENDENCIES.useCreateProjectMemberMutation>["mutate"]>();
    const updateGrant = vi.fn<ReturnType<typeof DEPENDENCIES.useUpdateProjectMemberMutation>["mutate"]>();
    const deleteGrant = vi.fn<ReturnType<typeof DEPENDENCIES.useDeleteProjectMemberMutation>["mutate"]>();
    const confirm = vi.fn(async () => input.isConfirmed ?? true);
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();

    const dependencies: typeof DEPENDENCIES = {
      usePopup: () => mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useProjectMembersQuery: () =>
        input.isLoadingGrants
          ? mock<ReturnType<typeof DEPENDENCIES.useProjectMembersQuery>>({ data: undefined, isLoading: true })
          : mock<ReturnType<typeof DEPENDENCIES.useProjectMembersQuery>>({ data: input.grants ?? [BOB_GRANT, CAROL_GRANT], isLoading: false }),
      useOrganizationMembersQuery: () =>
        mock<ReturnType<typeof DEPENDENCIES.useOrganizationMembersQuery>>({
          data: input.organizationMembers ?? [OWNER, ADMIN, BILLING, BOB, DAVE, ERIN, CAROL],
          isLoading: false
        }),
      useCreateProjectMemberMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCreateProjectMemberMutation>>({ mutate: createGrant, isPending: input.isGranting ?? false }),
      useUpdateProjectMemberMutation: () => mock<ReturnType<typeof DEPENDENCIES.useUpdateProjectMemberMutation>>({ mutate: updateGrant }),
      useDeleteProjectMemberMutation: () => mock<ReturnType<typeof DEPENDENCIES.useDeleteProjectMemberMutation>>({ mutate: deleteGrant })
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

    return { user: userEvent.setup(), createGrant, updateGrant, deleteGrant, confirm, enqueueSnackbar, onClose };
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
  return { id: `member-${name}`, userId: `user-${name}`, username: name, email: `${name}@acme.io`, role, createdAt: "2026-01-01T00:00:00Z" };
}

const OWNER = organizationMember("owner", "owner");
const ADMIN = organizationMember("admin", "admin");
const BILLING = organizationMember("billing", "billing");
const BOB = organizationMember("bob", "member");
const DAVE = organizationMember("dave", "member");
const ERIN = organizationMember("erin", "viewer");
const CAROL: OrganizationMemberOutput = { ...organizationMember("carol", "member"), userId: "user-carol", username: null };
