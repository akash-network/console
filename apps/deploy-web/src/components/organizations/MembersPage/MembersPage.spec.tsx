import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput, OrganizationRole, OrganizationType } from "@src/types/organization";
import type { OrganizationInvitationOutput, OrganizationMemberOutput } from "@src/types/organizationMembership";
import { DEPENDENCIES, MembersPage } from "./MembersPage";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(MembersPage.name, () => {
  it("lets an admin invite people and manage the roster and the pending invitations", () => {
    const { MemberRoster, PendingInvitationList, AdminAccessRequestNotice, useOrganizationMembersQuery, useOrganizationInvitationsQuery } = setup({
      role: "admin"
    });

    expect(screen.getByRole("button", { name: "Invite members" })).toBeInTheDocument();
    expect(AdminAccessRequestNotice).not.toHaveBeenCalled();
    expect(MemberRoster.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        members: [BOB],
        isLoading: false,
        isError: false,
        organizationName: "Acme Corp",
        viewerRole: "admin",
        viewerUserId: "user-alice"
      })
    );
    expect(PendingInvitationList.mock.lastCall?.[0]).toEqual(expect.objectContaining({ invitations: [ERIN], isLoading: false }));
    expect(useOrganizationMembersQuery).toHaveBeenCalledWith({ enabled: true });
    expect(useOrganizationInvitationsQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("opens the invite dialog with the members' addresses and the invitations still running, so expired ones can be renewed", async () => {
    const { user, InviteMembersDialog } = setup({ role: "owner", members: [BOB, { ...BOB, id: "member-2", email: null }], invitations: [ERIN, FRANK] });

    await user.click(screen.getByRole("button", { name: "Invite members" }));

    expect(InviteMembersDialog.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ organizationName: "Acme Corp", memberEmails: ["bob@acme.io"], invitedEmails: ["erin@acme.io"] })
    );
  });

  it("closes the invite dialog", async () => {
    const { user, InviteMembersDialog } = setup({ role: "owner" });
    await user.click(screen.getByRole("button", { name: "Invite members" }));
    const callsWhileOpen = InviteMembersDialog.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(InviteMembersDialog.mock.calls).toHaveLength(callsWhileOpen);
    expect(screen.queryByRole("button", { name: "Close dialog" })).not.toBeInTheDocument();
  });

  it("passes empty address lists to the invite dialog while the lists load", async () => {
    const { user, InviteMembersDialog } = setup({ role: "owner", members: undefined, invitations: undefined });

    await user.click(screen.getByRole("button", { name: "Invite members" }));

    expect(InviteMembersDialog.mock.lastCall?.[0]).toEqual(expect.objectContaining({ memberEmails: [], invitedEmails: [] }));
  });

  it.each(["member", "viewer", "billing"] as const)("shows a %s a read-only roster without invitations, with a way to ask for admin access", role => {
    const { PendingInvitationList, AdminAccessRequestNotice, useOrganizationInvitationsQuery } = setup({ role });

    expect(screen.queryByRole("button", { name: "Invite members" })).not.toBeInTheDocument();
    expect(AdminAccessRequestNotice.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ organization: expect.objectContaining({ id: "org-2", role }), adminOnlyAction: "invite people or change roles" })
    );
    expect(PendingInvitationList).not.toHaveBeenCalled();
    expect(useOrganizationInvitationsQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("sends a personal account away, since it has no members page", () => {
    const { replace, MemberRoster, useOrganizationMembersQuery } = setup({ type: "personal" });

    expect(replace).toHaveBeenCalledWith("/deployments");
    expect(MemberRoster).not.toHaveBeenCalled();
    expect(useOrganizationMembersQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("sends everyone away while organizations are off", () => {
    const { replace, MemberRoster } = setup({ isEnabled: false });

    expect(replace).toHaveBeenCalledWith("/deployments");
    expect(MemberRoster).not.toHaveBeenCalled();
  });

  it("sends the user away when no organization could be loaded", () => {
    const { replace, MemberRoster } = setup({ hasOrganization: false, hasNoOrganizations: true });

    expect(replace).toHaveBeenCalledWith("/deployments");
    expect(MemberRoster).not.toHaveBeenCalled();
  });

  it("waits for the active organization without leaving", () => {
    const { replace, MemberRoster, Layout } = setup({ hasOrganization: false });

    expect(replace).not.toHaveBeenCalled();
    expect(MemberRoster).not.toHaveBeenCalled();
    expect(Layout.mock.lastCall?.[0]).toEqual(expect.objectContaining({ isLoading: true }));
  });

  function setup(input: {
    role?: OrganizationRole;
    type?: OrganizationType;
    isEnabled?: boolean;
    hasOrganization?: boolean;
    hasNoOrganizations?: boolean;
    members?: OrganizationMemberOutput[];
    invitations?: OrganizationInvitationOutput[];
  }) {
    const organization: OrganizationOutput = {
      id: "org-2",
      name: "Acme Corp",
      slug: "acme-corp",
      type: input.type ?? "team",
      role: input.role ?? "owner",
      isActive: true,
      hasPaymentMethod: true,
      createdAt: "2026-02-01T00:00:00Z"
    };
    const replace = vi.fn();
    const Layout = vi.fn<typeof DEPENDENCIES.Layout>(({ children }) => <>{children}</>);
    const SettingsLayout = vi.fn<typeof DEPENDENCIES.SettingsLayout>(({ children, headerActions }) => (
      <>
        {headerActions}
        {children}
      </>
    ));
    const MemberRoster = vi.fn<typeof DEPENDENCIES.MemberRoster>(() => null);
    const PendingInvitationList = vi.fn<typeof DEPENDENCIES.PendingInvitationList>(() => null);
    const InviteMembersDialog = vi.fn<typeof DEPENDENCIES.InviteMembersDialog>(({ onClose }) => (
      <button type="button" onClick={onClose}>
        Close dialog
      </button>
    ));
    const AdminAccessRequestNotice = vi.fn<typeof DEPENDENCIES.AdminAccessRequestNotice>(() => null);
    const useOrganizationMembersQuery = vi.fn(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useOrganizationMembersQuery>>({ isLoading: false, isError: false }), {
        data: "members" in input ? input.members : [BOB]
      })
    );
    const useOrganizationInvitationsQuery = vi.fn(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useOrganizationInvitationsQuery>>({ isLoading: false }), {
        data: "invitations" in input ? input.invitations : [ERIN]
      })
    );

    const dependencies = MockComponents(DEPENDENCIES, {
      Layout,
      SettingsLayout,
      MemberRoster,
      PendingInvitationList,
      InviteMembersDialog,
      AdminAccessRequestNotice,
      useFlag: () => input.isEnabled ?? true,
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          activeOrganization: input.hasOrganization ?? true ? organization : undefined,
          isError: input.hasNoOrganizations ?? false
        }),
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: { id: "user-alice" } }),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace }),
      useOrganizationMembersQuery,
      useOrganizationInvitationsQuery
    });

    render(<MembersPage dependencies={dependencies} />);

    return {
      user: userEvent.setup(),
      replace,
      Layout,
      MemberRoster,
      PendingInvitationList,
      InviteMembersDialog,
      AdminAccessRequestNotice,
      useOrganizationMembersQuery,
      useOrganizationInvitationsQuery
    };
  }
});

const BOB: OrganizationMemberOutput = {
  id: "member-1",
  userId: "user-bob",
  username: "bob",
  email: "bob@acme.io",
  role: "member",
  projectAccess: "selected",
  projectCount: 1,
  createdAt: "2026-02-01T00:00:00Z"
};

const ERIN: OrganizationInvitationOutput = {
  id: "invitation-1",
  email: "erin@acme.io",
  role: "member",
  projectAccess: "all",
  projectGrants: [],
  invitedBy: null,
  createdAt: "2026-10-01T00:00:00Z",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
};

const FRANK: OrganizationInvitationOutput = { ...ERIN, id: "invitation-2", email: "frank@acme.io", expiresAt: new Date(Date.now() - 60_000).toISOString() };
