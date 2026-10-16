import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationRole } from "@src/types/organization";
import type { OrganizationMemberOutput } from "@src/types/organizationMembership";
import type { DEPENDENCIES } from "./DeleteTeamSetting";
import { DeleteTeamSetting } from "./DeleteTeamSetting";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(DeleteTeamSetting.name, () => {
  it("warns the owner that deleting the organization is permanent and forfeits its credits", () => {
    const { useOrganizationMembersQuery } = setup({ role: "owner" });

    expect(screen.getByText("Delete organization", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Permanently delete Acme Corp for everyone in it, forfeiting its remaining credits. This can't be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete organization" })).toBeEnabled();
    expect(useOrganizationMembersQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("opens the deletion dialog for the owner and closes it again", async () => {
    const { user, DeleteTeamDialog } = setup({ role: "owner" });

    expect(DeleteTeamDialog).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete organization" }));

    expect(DeleteTeamDialog.mock.lastCall?.[0]).toEqual(expect.objectContaining({ organization: expect.objectContaining({ id: "org-2", name: "Acme Corp" }) }));

    await user.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(screen.queryByRole("button", { name: "Close dialog" })).not.toBeInTheDocument();
  });

  it.each(["admin", "member", "viewer", "billing"] as const)("shows a %s who owns the organization, without letting them delete it", async role => {
    const { user, DeleteTeamDialog, useOrganizationMembersQuery } = setup({ role, members: [ALICE, BOB] });

    expect(screen.getByText("Only the owner, alice, can delete Acme Corp.")).toBeInTheDocument();
    expect(useOrganizationMembersQuery).toHaveBeenCalledWith({ enabled: true });

    await user.click(screen.getByRole("button", { name: "Delete organization" }));

    expect(screen.getByRole("button", { name: "Delete organization" })).toBeDisabled();
    expect(DeleteTeamDialog).not.toHaveBeenCalled();
  });

  it("names every owner of an organization that has several", () => {
    setup({ role: "member", members: [ALICE, BOB, CAROL] });

    expect(screen.getByText("Only the owners, alice and carol, can delete Acme Corp.")).toBeInTheDocument();
  });

  it("names no owner while the members load", () => {
    setup({ role: "admin" });

    expect(screen.getByText("Only the owner can delete Acme Corp.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete organization" })).toBeDisabled();
  });

  function setup(input: { role: OrganizationRole; members?: OrganizationMemberOutput[] }) {
    const DeleteTeamDialog = vi.fn<typeof DEPENDENCIES.DeleteTeamDialog>(({ onClose }) => (
      <button type="button" onClick={onClose}>
        Close dialog
      </button>
    ));
    const useOrganizationMembersQuery = vi.fn(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useOrganizationMembersQuery>>(), { data: input.members })
    );

    render(
      <DeleteTeamSetting organization={{ id: "org-2", name: "Acme Corp", role: input.role }} dependencies={{ useOrganizationMembersQuery, DeleteTeamDialog }} />
    );

    return { user: userEvent.setup(), DeleteTeamDialog, useOrganizationMembersQuery };
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

const BOB: OrganizationMemberOutput = { ...ALICE, id: "member-bob", userId: "user-bob", username: "bob", email: "bob@acme.io", role: "member" };

const CAROL: OrganizationMemberOutput = { ...ALICE, id: "member-carol", userId: "user-carol", username: "carol", email: "carol@acme.io" };
