import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationInvitationOutput } from "@src/types/organizationMembership";
import type { DEPENDENCIES } from "./PendingInvitationList";
import { PendingInvitationList } from "./PendingInvitationList";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("PendingInvitationList", () => {
  it("lists each invitation with its role, when it was sent and when it expires", () => {
    setup({});

    expect(screen.getByText("2 pending")).toBeInTheDocument();
    expect(screen.getByText("carol@acme.io")).toBeInTheDocument();
    expect(screen.getByText("Invited 1 day ago · Expires in 6 days")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Invited 8 days ago · Expired")).toBeInTheDocument();
  });

  it("says when nobody is waiting on an invitation", () => {
    setup({ invitations: [] });

    expect(screen.getByText("No pending invitations.")).toBeInTheDocument();
    expect(screen.getByText("0 pending")).toBeInTheDocument();
  });

  it("shows placeholders while the invitations load", () => {
    setup({ invitations: undefined, isLoading: true });

    expect(screen.queryByText("No pending invitations.")).not.toBeInTheDocument();
    expect(screen.queryByText(/pending$/)).not.toBeInTheDocument();
  });

  it("resends an invitation", async () => {
    const { user, resendInvitation, enqueueSnackbar } = setup({});
    resendInvitation.mockImplementation((input, options) => options?.onSuccess?.({ data: CAROL }, input, undefined));

    await openMenuOf(user, "carol@acme.io", "Resend invite");

    expect(resendInvitation.mock.lastCall?.[0]).toEqual({ id: "invitation-carol" });
    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Invite resent to carol@acme.io", subTitle: undefined, variant: "success" });
  });

  it("explains a refused resend", async () => {
    const { user, resendInvitation, enqueueSnackbar } = setup({});
    resendInvitation.mockImplementation((input, options) => options?.onError?.(new Error("boom"), input, undefined));

    await openMenuOf(user, "carol@acme.io", "Resend invite");

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Couldn't resend the invite to carol@acme.io", subTitle: undefined, variant: "error" });
  });

  it("copies a fresh invite link and warns that older links stop working", async () => {
    const { user, createInvitationLink, writeText, enqueueSnackbar } = setup({});
    createInvitationLink.mockResolvedValue({ data: { url: INVITE_URL } });

    await openMenuOf(user, "carol@acme.io", "Copy invite link");

    expect(createInvitationLink.mock.lastCall?.[0]).toEqual({ id: "invitation-carol" });
    await waitFor(() =>
      expect(lastSnackbar(enqueueSnackbar)).toEqual({
        title: "Invite link copied",
        subTitle: "The emailed link and earlier copied links no longer work.",
        variant: "success"
      })
    );
    expect(writeText).toHaveBeenCalledWith(INVITE_URL);
  });

  it("shows the link when the clipboard refuses it", async () => {
    const { user, createInvitationLink, enqueueSnackbar } = setup({ isCopied: false });
    createInvitationLink.mockResolvedValue({ data: { url: INVITE_URL } });

    await openMenuOf(user, "carol@acme.io", "Copy invite link");

    await waitFor(() => expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Couldn't copy the invite link", subTitle: INVITE_URL, variant: "error" }));
  });

  it("explains why a link could not be created", async () => {
    const { user, createInvitationLink, writeText, enqueueSnackbar } = setup({});
    createInvitationLink.mockRejectedValue(new ApiError(403, { code: "personal_organization" }, "POST"));

    await openMenuOf(user, "carol@acme.io", "Copy invite link");

    await waitFor(() =>
      expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "You can't invite people to a personal account.", subTitle: undefined, variant: "error" })
    );
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when a link fails for another reason", async () => {
    const { user, createInvitationLink, enqueueSnackbar } = setup({});
    createInvitationLink.mockRejectedValue(new Error("boom"));

    await openMenuOf(user, "carol@acme.io", "Copy invite link");

    await waitFor(() => expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Couldn't create an invite link", subTitle: undefined, variant: "error" }));
  });

  it("revokes an invitation", async () => {
    const { user, deleteInvitation, enqueueSnackbar } = setup({});
    deleteInvitation.mockImplementation((input, options) => options?.onSuccess?.(undefined, input, undefined));

    await openMenuOf(user, "dan@acme.io", "Revoke invite");

    expect(deleteInvitation.mock.lastCall?.[0]).toEqual({ id: "invitation-dan" });
    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Invite to dan@acme.io revoked", subTitle: undefined, variant: "success" });
  });

  it("explains a refused revocation", async () => {
    const { user, deleteInvitation, enqueueSnackbar } = setup({});
    deleteInvitation.mockImplementation((input, options) => options?.onError?.(new Error("boom"), input, undefined));

    await openMenuOf(user, "dan@acme.io", "Revoke invite");

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Couldn't revoke the invite to dan@acme.io", subTitle: undefined, variant: "error" });
  });

  async function openMenuOf(user: ReturnType<typeof userEvent.setup>, email: string, action: string) {
    await user.click(screen.getByRole("button", { name: `Actions for the invite to ${email}` }));
    await user.click(screen.getByRole("menuitem", { name: action }));
  }

  function lastSnackbar(enqueueSnackbar: ReturnType<typeof vi.fn>) {
    const [element, options] = enqueueSnackbar.mock.lastCall as [{ props: { title: string; subTitle?: string } }, { variant: string }];
    return { title: element.props.title, subTitle: element.props.subTitle, variant: options.variant };
  }

  function setup(input: { invitations?: OrganizationInvitationOutput[]; isLoading?: boolean; isCopied?: boolean }) {
    const resendInvitation = vi.fn<ReturnType<typeof DEPENDENCIES.useResendOrganizationInvitationMutation>["mutate"]>();
    const createInvitationLink = vi.fn<ReturnType<typeof DEPENDENCIES.useCreateOrganizationInvitationLinkMutation>["mutateAsync"]>();
    const deleteInvitation = vi.fn<ReturnType<typeof DEPENDENCIES.useDeleteOrganizationInvitationMutation>["mutate"]>();
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockImplementation(() => (input.isCopied ?? true ? Promise.resolve() : Promise.reject(new Error("Not allowed"))));
    writeText.mockClear();
    const enqueueSnackbar = vi.fn();

    const dependencies: typeof DEPENDENCIES = {
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useResendOrganizationInvitationMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useResendOrganizationInvitationMutation>>({ mutate: resendInvitation }),
      useCreateOrganizationInvitationLinkMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCreateOrganizationInvitationLinkMutation>>({ mutateAsync: createInvitationLink }),
      useDeleteOrganizationInvitationMutation: () => mock<ReturnType<typeof DEPENDENCIES.useDeleteOrganizationInvitationMutation>>({ mutate: deleteInvitation })
    };

    render(
      <PendingInvitationList
        invitations={"invitations" in input ? input.invitations : [CAROL, DAN]}
        isLoading={input.isLoading ?? false}
        dependencies={dependencies}
      />
    );

    return { user, resendInvitation, createInvitationLink, deleteInvitation, writeText, enqueueSnackbar };
  }
});

const DAY_MS = 24 * 60 * 60 * 1000;

const INVITE_URL = "https://console.akash.network/invitations/token-2";

const CAROL: OrganizationInvitationOutput = {
  id: "invitation-carol",
  email: "carol@acme.io",
  role: "admin",
  projectGrants: [],
  invitedBy: { id: "user-alice", username: "alice" },
  createdAt: new Date(Date.now() - DAY_MS).toISOString(),
  expiresAt: new Date(Date.now() + 6 * DAY_MS + 60_000).toISOString()
};

const DAN: OrganizationInvitationOutput = {
  id: "invitation-dan",
  email: "dan@acme.io",
  role: "member",
  projectGrants: [],
  invitedBy: null,
  createdAt: new Date(Date.now() - 8 * DAY_MS).toISOString(),
  expiresAt: new Date(Date.now() - DAY_MS).toISOString()
};
