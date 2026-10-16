import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationRole } from "@src/types/organization";
import type { OrganizationMemberOutput } from "@src/types/organizationMembership";
import type { DEPENDENCIES } from "./LeaveOrganizationSetting";
import { LeaveOrganizationSetting } from "./LeaveOrganizationSetting";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("LeaveOrganizationSetting", () => {
  it.each(["admin", "member", "viewer", "billing"] as const)("lets a %s leave after confirming in a dialog", async role => {
    const { user, LeaveOrganizationDialog, useOrganizationMembersQuery } = setup({ role });

    expect(screen.getByText("You lose access to Acme Corp and its projects. Deployments keep running.")).toBeInTheDocument();
    expect(useOrganizationMembersQuery).toHaveBeenCalledWith({ enabled: false });

    await user.click(screen.getByRole("button", { name: "Leave organization" }));

    expect(LeaveOrganizationDialog.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ organization: expect.objectContaining({ id: "org-2", name: "Acme Corp" }) })
    );
  });

  it("closes the dialog", async () => {
    const { user } = setup({ role: "member" });
    await user.click(screen.getByRole("button", { name: "Leave organization" }));

    await user.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(screen.queryByRole("button", { name: "Close dialog" })).not.toBeInTheDocument();
  });

  it("keeps the owner from leaving and points them to the Members page to transfer ownership", () => {
    const { useOrganizationMembersQuery } = setup({ role: "owner", members: [ALICE, BOB] });

    expect(screen.getByRole("button", { name: "Leave organization" })).toBeDisabled();
    expect(screen.getByText(/Transfer ownership on the/)).toHaveTextContent("You own Acme Corp. Transfer ownership on the Members page before you leave.");
    expect(screen.getByRole("link", { name: "Members" })).toHaveAttribute("href", "/members");
    expect(useOrganizationMembersQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("tells an owner who is the only member to delete the organization instead", () => {
    setup({ role: "owner", members: [ALICE] });

    expect(screen.getByRole("button", { name: "Leave organization" })).toBeDisabled();
    expect(screen.getByText("You're the only member of Acme Corp. Delete it instead if you no longer need it.")).toBeInTheDocument();
  });

  function setup(input: { role: OrganizationRole; members?: OrganizationMemberOutput[] }) {
    const LeaveOrganizationDialog = vi.fn<typeof DEPENDENCIES.LeaveOrganizationDialog>(({ onClose }) => (
      <button type="button" onClick={onClose}>
        Close dialog
      </button>
    ));
    const useOrganizationMembersQuery = vi.fn(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useOrganizationMembersQuery>>(), { data: input.members })
    );

    render(
      <LeaveOrganizationSetting
        organization={{ id: "org-2", name: "Acme Corp", role: input.role }}
        dependencies={{ useOrganizationMembersQuery, LeaveOrganizationDialog }}
      />
    );

    return { user: userEvent.setup(), LeaveOrganizationDialog, useOrganizationMembersQuery };
  }
});

const ALICE: OrganizationMemberOutput = {
  id: "member-alice",
  userId: "user-alice",
  username: "alice",
  email: "alice@acme.io",
  role: "owner",
  createdAt: "2026-01-01T00:00:00Z"
};

const BOB: OrganizationMemberOutput = { ...ALICE, id: "member-bob", userId: "user-bob", username: "bob", email: "bob@acme.io", role: "member" };
