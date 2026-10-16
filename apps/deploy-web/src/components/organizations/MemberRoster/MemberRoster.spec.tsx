import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationRole } from "@src/types/organization";
import type { OrganizationMemberOutput } from "@src/types/organizationMembership";
import type { DEPENDENCIES } from "./MemberRoster";
import { MemberRoster } from "./MemberRoster";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("MemberRoster", () => {
  it("lists owners first, then admins, then everyone else by name, with the totals", () => {
    setup({});

    const rows = within(screen.getByRole("list", { name: "Members" })).getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringContaining("alice"),
      expect.stringContaining("dave"),
      expect.stringContaining("bob"),
      expect.stringContaining("carol@acme.io")
    ]);
    expect(screen.getByText("4 members · 2 admins")).toBeInTheDocument();
  });

  it("marks the viewer and the owner, and never lets anyone edit them", () => {
    setup({});

    const ownerRow = rowOf("alice");
    expect(within(ownerRow).getByText("You")).toBeInTheDocument();
    expect(within(ownerRow).getByText("Owner")).toBeInTheDocument();
    expect(within(ownerRow).getByText("Admin")).toBeInTheDocument();
    expect(within(ownerRow).queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers no actions on the owner or on the admin reading the roster", () => {
    setup({ viewerRole: "admin", viewerUserId: "user-dave" });

    expect(within(rowOf("alice")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(rowOf("dave")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(rowOf("bob")).getByRole("button", { name: "Actions for bob" })).toBeInTheDocument();
  });

  it("shows the email under a username and falls back to the email as the name", () => {
    setup({});

    expect(within(rowOf("bob")).getByText("bob@acme.io")).toBeInTheDocument();
    expect(within(rowOf("carol@acme.io")).getAllByText("carol@acme.io")).toHaveLength(1);
  });

  it("shows when each member joined", () => {
    setup({});

    expect(within(rowOf("bob")).getByText(/^Joined .+ ago$/)).toBeInTheDocument();
  });

  it("shows each member's project access", () => {
    setup({ members: [ALICE, { ...BOB, projectCount: 3 }, { ...CAROL, projectCount: 0 }, { ...DAVE, projectAccess: "all" }, ERIN, FRANK] });

    expect(within(rowOf("alice")).getByText("All projects")).toBeInTheDocument();
    expect(within(rowOf("bob")).getByText("3 projects")).toBeInTheDocument();
    expect(within(rowOf("carol@acme.io")).getByText("No projects")).toBeInTheDocument();
    expect(within(rowOf("erin")).getByText("All projects")).toBeInTheDocument();
    expect(within(rowOf("frank")).queryByText(/project/)).not.toBeInTheDocument();
  });

  it("counts a single granted project in the singular", () => {
    setup({ members: [ALICE, { ...BOB, projectCount: 1 }] });

    expect(within(rowOf("bob")).getByText("1 project")).toBeInTheDocument();
  });

  it("edits a member in a dialog and closes it once done", async () => {
    const { user, EditMemberDialog } = setup({ viewerRole: "admin", viewerUserId: "user-dave" });

    await user.click(screen.getByRole("button", { name: "Actions for bob" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit member" }));

    expect(EditMemberDialog.mock.lastCall?.[0]).toMatchObject({ member: BOB, organizationName: "Acme Corp" });

    await user.click(screen.getByRole("button", { name: "close the edit" }));

    expect(screen.queryByRole("button", { name: "close the edit" })).not.toBeInTheDocument();
  });

  it("removes a member once the removal is confirmed", async () => {
    const { user, confirm, deleteMember, enqueueSnackbar } = setup({ viewerRole: "admin" });
    deleteMember.mockImplementation((input, options) => options?.onSuccess?.(undefined, input, undefined));

    await user.click(screen.getByRole("button", { name: "Actions for bob" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove from organization" }));

    expect(confirm).toHaveBeenCalledWith({
      title: "Remove bob?",
      message: "bob loses access to Acme Corp and its projects right away. Their deployments keep running."
    });
    expect(deleteMember.mock.lastCall?.[0]).toEqual({ id: "member-bob" });
    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "bob was removed from Acme Corp", variant: "success" });
  });

  it("keeps the member when the removal is cancelled", async () => {
    const { user, deleteMember } = setup({ viewerRole: "admin", isConfirmed: false });

    await user.click(screen.getByRole("button", { name: "Actions for bob" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove from organization" }));

    expect(deleteMember).not.toHaveBeenCalled();
  });

  it("reports a refused removal", async () => {
    const { user, deleteMember, enqueueSnackbar } = setup({ viewerRole: "admin" });
    deleteMember.mockImplementation((input, options) => options?.onError?.(new Error("boom"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Actions for bob" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove from organization" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Couldn't remove bob", variant: "error" });
  });

  it("only lets the owner transfer ownership", async () => {
    const { user } = setup({ viewerRole: "admin", viewerUserId: "user-dave" });

    await user.click(screen.getByRole("button", { name: "Actions for bob" }));

    expect(screen.queryByRole("menuitem", { name: "Transfer ownership" })).not.toBeInTheDocument();
  });

  it("transfers ownership once the owner confirms", async () => {
    const { user, confirm, transferOwnership, enqueueSnackbar } = setup({});
    transferOwnership.mockImplementation((input, options) => options?.onSuccess?.({ data: { ...BOB, role: "owner" } }, input, undefined));

    await user.click(screen.getByRole("button", { name: "Actions for bob" }));
    await user.click(screen.getByRole("menuitem", { name: "Transfer ownership" }));

    expect(confirm).toHaveBeenCalledWith({
      title: "Transfer ownership to bob?",
      message: "bob becomes the owner of Acme Corp. You stay on as an Admin. Only the owner can transfer ownership."
    });
    expect(transferOwnership.mock.lastCall?.[0]).toEqual({ id: "member-bob" });
    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "bob is now the owner of Acme Corp", variant: "success" });
  });

  it("keeps ownership when the transfer is cancelled", async () => {
    const { user, transferOwnership } = setup({ isConfirmed: false });

    await user.click(screen.getByRole("button", { name: "Actions for bob" }));
    await user.click(screen.getByRole("menuitem", { name: "Transfer ownership" }));

    expect(transferOwnership).not.toHaveBeenCalled();
  });

  it("explains a refused transfer", async () => {
    const { user, transferOwnership, enqueueSnackbar } = setup({});
    transferOwnership.mockImplementation((input, options) =>
      options?.onError?.(new ApiError(403, { code: "owner_role_restricted" }, "POST"), input, undefined)
    );

    await user.click(screen.getByRole("button", { name: "Actions for bob" }));
    await user.click(screen.getByRole("menuitem", { name: "Transfer ownership" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Only the owner can change the owner's role or hand over ownership.", variant: "error" });
  });

  it("falls back to a generic message when a transfer fails for another reason", async () => {
    const { user, transferOwnership, enqueueSnackbar } = setup({});
    transferOwnership.mockImplementation((input, options) => options?.onError?.(new Error("boom"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Actions for bob" }));
    await user.click(screen.getByRole("menuitem", { name: "Transfer ownership" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Couldn't transfer ownership to bob", variant: "error" });
  });

  it.each(["member", "viewer", "billing"] as const)("shows a read-only roster to a %s", role => {
    setup({ viewerRole: role, viewerUserId: "user-bob" });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(within(rowOf("dave")).getByText("Admin")).toBeInTheDocument();
  });

  it("says when the roster could not be loaded", () => {
    setup({ members: undefined, isError: true });

    expect(screen.getByText("Couldn't load the members")).toBeInTheDocument();
    expect(screen.queryByText(/members ·/)).not.toBeInTheDocument();
  });

  it("shows placeholders while the roster loads", () => {
    setup({ members: undefined, isLoading: true });

    expect(screen.queryByRole("list", { name: "Members" })).not.toBeInTheDocument();
    expect(screen.queryByText("Couldn't load the members")).not.toBeInTheDocument();
  });

  it("counts a single member and a single admin in the singular", () => {
    setup({ members: [ALICE] });

    expect(screen.getByText("1 member · 1 admin")).toBeInTheDocument();
  });

  function rowOf(name: string) {
    return within(screen.getByRole("list", { name: "Members" }))
      .getAllByRole("listitem")
      .find(row => row.textContent?.includes(name)) as HTMLElement;
  }

  function lastSnackbar(enqueueSnackbar: ReturnType<typeof vi.fn>) {
    const [element, options] = enqueueSnackbar.mock.lastCall as [{ props: { title: string } }, { variant: string }];
    return { title: element.props.title, variant: options.variant };
  }

  function setup(input: {
    members?: OrganizationMemberOutput[];
    viewerRole?: OrganizationRole;
    viewerUserId?: string;
    isLoading?: boolean;
    isError?: boolean;
    isConfirmed?: boolean;
  }) {
    const deleteMember = vi.fn<ReturnType<typeof DEPENDENCIES.useDeleteOrganizationMemberMutation>["mutate"]>();
    const transferOwnership = vi.fn<ReturnType<typeof DEPENDENCIES.useTransferOrganizationOwnershipMutation>["mutate"]>();
    const confirm = vi.fn(async () => input.isConfirmed ?? true);
    const enqueueSnackbar = vi.fn();
    const EditMemberDialog = vi.fn<typeof DEPENDENCIES.EditMemberDialog>(({ onClose }) => (
      <button type="button" onClick={onClose}>
        close the edit
      </button>
    ));

    const dependencies: typeof DEPENDENCIES = {
      usePopup: () => mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useDeleteOrganizationMemberMutation: () => mock<ReturnType<typeof DEPENDENCIES.useDeleteOrganizationMemberMutation>>({ mutate: deleteMember }),
      useTransferOrganizationOwnershipMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useTransferOrganizationOwnershipMutation>>({ mutate: transferOwnership }),
      EditMemberDialog
    };

    render(
      <MemberRoster
        members={"members" in input ? input.members : [BOB, CAROL, ALICE, DAVE]}
        isLoading={input.isLoading ?? false}
        isError={input.isError ?? false}
        organizationName="Acme Corp"
        viewerRole={input.viewerRole ?? "owner"}
        viewerUserId={input.viewerUserId ?? "user-alice"}
        dependencies={dependencies}
      />
    );

    return { user: userEvent.setup(), deleteMember, transferOwnership, confirm, enqueueSnackbar, EditMemberDialog };
  }
});

const ALICE: OrganizationMemberOutput = {
  id: "member-alice",
  userId: "user-alice",
  username: "alice",
  email: "alice@acme.io",
  role: "owner",
  projectAccess: "all",
  projectCount: null,
  createdAt: "2026-01-01T00:00:00Z"
};

const BOB: OrganizationMemberOutput = {
  id: "member-bob",
  userId: "user-bob",
  username: "bob",
  email: "bob@acme.io",
  role: "member",
  projectAccess: "selected",
  projectCount: 2,
  createdAt: "2026-02-01T00:00:00Z"
};

const CAROL: OrganizationMemberOutput = {
  id: "member-carol",
  userId: "user-carol",
  username: null,
  email: "carol@acme.io",
  role: "member",
  projectAccess: "selected",
  projectCount: 1,
  createdAt: "2026-03-01T00:00:00Z"
};

const DAVE: OrganizationMemberOutput = {
  id: "member-dave",
  userId: "user-dave",
  username: "dave",
  email: "dave@acme.io",
  role: "admin",
  projectAccess: "all",
  projectCount: null,
  createdAt: "2026-04-01T00:00:00Z"
};

const ERIN: OrganizationMemberOutput = {
  id: "member-erin",
  userId: "user-erin",
  username: "erin",
  email: "erin@acme.io",
  role: "viewer",
  projectAccess: "all",
  projectCount: null,
  createdAt: "2026-05-01T00:00:00Z"
};

const FRANK: OrganizationMemberOutput = {
  id: "member-frank",
  userId: "user-frank",
  username: "frank",
  email: "frank@acme.io",
  role: "billing",
  projectAccess: null,
  projectCount: null,
  createdAt: "2026-06-01T00:00:00Z"
};
