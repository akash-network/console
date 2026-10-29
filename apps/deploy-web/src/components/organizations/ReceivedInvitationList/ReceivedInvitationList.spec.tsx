import { ApiError } from "@akashnetwork/openapi-sdk";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@akashnetwork/ui/components";
import { addDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
import type { ReceivedInvitationOutput } from "@src/types/organizationMembership";
import type { DEPENDENCIES } from "./ReceivedInvitationList";
import { ReceivedInvitationList } from "./ReceivedInvitationList";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildReceivedInvitation } from "@tests/seeders/receivedInvitation";

describe(ReceivedInvitationList.name, () => {
  it("says who invited the user, to which team, as what and until when", () => {
    setup({
      invitations: [
        buildReceivedInvitation({ inviterName: "alice", organizationName: "Acme Corp", role: "admin", expiresAt: addDays(new Date(), 6).toISOString() })
      ]
    });

    expect(screen.getByRole("listitem")).toHaveTextContent("alice invited you to join Acme Corp as an Admin");
    expect(screen.getByText(/^Expires in 6 days$/)).toBeInTheDocument();
  });

  it("invites without naming an inviter that is gone", () => {
    setup({ invitations: [buildReceivedInvitation({ inviterName: null, organizationName: "Acme Corp" })] });

    expect(screen.getByRole("listitem")).toHaveTextContent("You're invited to join Acme Corp as a Member");
  });

  it("lists each invitation with its own answers", () => {
    setup({ invitations: [buildReceivedInvitation({ organizationName: "Acme Corp" }), buildReceivedInvitation({ organizationName: "Northwind Labs" })] });

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("menuitem", { name: "Accept the invitation to Acme Corp" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Decline the invitation to Northwind Labs" })).toBeInTheDocument();
  });

  it("joins the team, says so and switches to it once the menu has closed", async () => {
    const shown = buildReceivedInvitation({ id: "inv-1", organizationName: "Acme Corp" });
    const { user, acceptInvitation, switchOrganization, enqueueSnackbar } = setup({ invitations: [shown] });
    let finishJoining: (response: Awaited<ReturnType<typeof acceptInvitation>>) => void = () => undefined;
    acceptInvitation.mockReturnValue(new Promise(resolve => (finishJoining = resolve)));

    await user.click(screen.getByRole("menuitem", { name: "Accept the invitation to Acme Corp" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    finishJoining({ data: JOINED });

    await waitFor(() => expect(switchOrganization).toHaveBeenCalledWith(JOINED.id));
    expect(acceptInvitation).toHaveBeenCalledWith({ id: "inv-1" });
    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "You joined Acme Corp", variant: "success" });
  });

  it.each([
    { case: "explains a refusal the API names", error: refusal(410, "invitation_revoked"), title: "This invitation was revoked." },
    { case: "falls back to a generic message", error: new Error("offline"), title: "Couldn't join Acme Corp. Try again in a moment." }
  ])("$case when joining fails", async ({ error, title }) => {
    const { user, acceptInvitation, switchOrganization, enqueueSnackbar } = setup({
      invitations: [buildReceivedInvitation({ organizationName: "Acme Corp" })]
    });
    acceptInvitation.mockRejectedValue(error);

    await user.click(screen.getByRole("menuitem", { name: "Accept the invitation to Acme Corp" }));

    await waitFor(() => expect(lastSnackbar(enqueueSnackbar)).toEqual({ title, variant: "error" }));
    expect(switchOrganization).not.toHaveBeenCalled();
  });

  it("declines once the user confirms and says so", async () => {
    const { user, confirm, declineInvitation, enqueueSnackbar } = setup({
      invitations: [buildReceivedInvitation({ id: "inv-1", organizationName: "Acme Corp" })]
    });
    declineInvitation.mockResolvedValue(undefined);

    await user.click(screen.getByRole("menuitem", { name: "Decline the invitation to Acme Corp" }));

    await waitFor(() => expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "You declined the invitation to Acme Corp", variant: "success" }));
    expect(declineInvitation).toHaveBeenCalledWith({ id: "inv-1" });
    expect(confirm).toHaveBeenCalledWith({
      title: "Decline the invitation to Acme Corp?",
      message: "To join later, you'll need a new invitation."
    });
  });

  it("keeps the invitation when the user changes their mind", async () => {
    const { user, confirm, declineInvitation } = setup({ invitations: [buildReceivedInvitation({ organizationName: "Acme Corp" })], isConfirmed: false });

    await user.click(screen.getByRole("menuitem", { name: "Decline the invitation to Acme Corp" }));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(declineInvitation).not.toHaveBeenCalled();
  });

  it.each([
    { case: "explains a refusal the API names", error: refusal(409, "invitation_already_accepted"), title: "This invitation has already been accepted." },
    { case: "falls back to a generic message", error: new Error("offline"), title: "Couldn't decline the invitation to Acme Corp. Try again in a moment." }
  ])("$case when declining fails", async ({ error, title }) => {
    const { user, declineInvitation, enqueueSnackbar } = setup({ invitations: [buildReceivedInvitation({ organizationName: "Acme Corp" })] });
    declineInvitation.mockRejectedValue(error);

    await user.click(screen.getByRole("menuitem", { name: "Decline the invitation to Acme Corp" }));

    await waitFor(() => expect(lastSnackbar(enqueueSnackbar)).toEqual({ title, variant: "error" }));
  });

  function refusal(status: number, code: string) {
    return new ApiError(status, { code }, "POST /v1/received-invitations/{id}/accept");
  }

  function lastSnackbar(enqueueSnackbar: ReturnType<typeof vi.fn>) {
    const [element, options] = enqueueSnackbar.mock.lastCall as [{ props: { title: string } }, { variant: string }];
    return { title: element.props.title, variant: options.variant };
  }

  function setup(input: { invitations: ReceivedInvitationOutput[]; isConfirmed?: boolean }) {
    const acceptInvitation = vi.fn<ReturnType<typeof DEPENDENCIES.useAcceptReceivedInvitationMutation>["mutateAsync"]>();
    const declineInvitation = vi.fn<ReturnType<typeof DEPENDENCIES.useDeclineReceivedInvitationMutation>["mutateAsync"]>();
    const switchOrganization = vi.fn<ReturnType<typeof DEPENDENCIES.useActiveOrganization>["switchOrganization"]>().mockReturnValue(true);
    const confirm = vi.fn<ReturnType<typeof DEPENDENCIES.usePopup>["confirm"]>(async () => input.isConfirmed ?? true);
    const enqueueSnackbar = vi.fn();

    const dependencies: typeof DEPENDENCIES = {
      useAcceptReceivedInvitationMutation: () => mock<ReturnType<typeof DEPENDENCIES.useAcceptReceivedInvitationMutation>>({ mutateAsync: acceptInvitation }),
      useDeclineReceivedInvitationMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useDeclineReceivedInvitationMutation>>({ mutateAsync: declineInvitation }),
      useActiveOrganization: () => mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ switchOrganization }),
      usePopup: () => mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    render(
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger>Activity</DropdownMenuTrigger>
        <DropdownMenuContent>
          <ReceivedInvitationList invitations={input.invitations} dependencies={dependencies} />
        </DropdownMenuContent>
      </DropdownMenu>
    );

    return { user: userEvent.setup(), acceptInvitation, declineInvitation, switchOrganization, confirm, enqueueSnackbar };
  }
});

const JOINED: OrganizationOutput = {
  id: "org-2",
  name: "Acme Corp",
  slug: "acme-corp",
  type: "team",
  role: "member",
  isActive: false,
  hasPaymentMethod: null,
  createdAt: "2026-02-01T00:00:00Z"
};
