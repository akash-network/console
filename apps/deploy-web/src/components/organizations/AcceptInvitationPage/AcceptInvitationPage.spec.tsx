import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
import type { InvitationPreviewOutput } from "@src/types/organizationMembership";
import type { DEPENDENCIES } from "./AcceptInvitationPage";
import { AcceptInvitationPage } from "./AcceptInvitationPage";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(AcceptInvitationPage.name, () => {
  it("shows a signed-out invitee who invited them and to what before asking them to authenticate", () => {
    const { forgetToken } = setup({ isSignedIn: false });

    expect(screen.getByRole("heading", { name: "Join Acme Corp" })).toBeInTheDocument();
    expect(screen.getByText(/alice invited you to join/)).toHaveTextContent("alice invited you to join Acme Corp on Akash Console as a Member.");
    expect(screen.getByText(/^Sent to bob@acme\.io · Expires in/)).toBeInTheDocument();
    const signUpLink = screen.getByRole("link", { name: "Sign up to accept" }).getAttribute("href");
    const logInLink = screen.getByRole("link", { name: "Log in" }).getAttribute("href");
    expect(signUpLink).toContain("tab=signup");
    expect(signUpLink).toContain(`returnTo=${encodeURIComponent("/invitations")}`);
    expect(logInLink).toContain("tab=login");
    expect(logInLink).toContain(`returnTo=${encodeURIComponent("/invitations")}`);
    expect(signUpLink).not.toContain(TOKEN);
    expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
    expect(forgetToken).not.toHaveBeenCalled();
  });

  it("words an invitation without a known inviter and with an Admin role", () => {
    setup({ isSignedIn: false, preview: { inviterName: null, role: "admin" } });

    expect(screen.getByText(/You're invited to join/)).toHaveTextContent("You're invited to join Acme Corp on Akash Console as an Admin.");
  });

  it("waits for the token and the preview before showing anything", () => {
    const { useInvitationPreviewQuery } = setup({ token: undefined, preview: null });

    expect(screen.getByRole("status", { name: "Loading the invitation" })).toBeInTheDocument();
    expect(useInvitationPreviewQuery).toHaveBeenCalledWith(undefined);
  });

  it("explains a visit without a token and forgets nothing it could still use", () => {
    const { forgetToken } = setup({ token: null, preview: null });

    expect(screen.getByRole("heading", { name: "This invitation link doesn't work" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(forgetToken).toHaveBeenCalled();
  });

  it.each([404, 400])("explains a link the API answers %s for and forgets its token", status => {
    const { forgetToken } = setup({ preview: null, error: new ApiError(status, { code: "not_found" }, "POST") });

    expect(screen.getByRole("heading", { name: "This invitation link doesn't work" })).toBeInTheDocument();
    expect(forgetToken).toHaveBeenCalled();
  });

  it.each([503, 429, 401, 403])("keeps the token when the preview fails with %s, which may pass on a retry", status => {
    const { forgetToken } = setup({ preview: null, error: new ApiError(status, {}, "POST") });

    expect(screen.getByRole("heading", { name: "Couldn't load this invitation" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "This invitation link doesn't work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(forgetToken).not.toHaveBeenCalled();
  });

  it("shows only the failure when refreshing an already loaded invitation fails", () => {
    setup({ error: new ApiError(503, {}, "POST") });

    expect(screen.getByRole("heading", { name: "Couldn't load this invitation" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Join Acme Corp" })).not.toBeInTheDocument();
  });

  it("shows only the broken link when refreshing an already loaded invitation finds it gone", () => {
    setup({ error: new ApiError(404, { code: "not_found" }, "POST") });

    expect(screen.getByRole("heading", { name: "This invitation link doesn't work" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Join Acme Corp" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Couldn't load this invitation" })).not.toBeInTheDocument();
  });

  it("explains an expired invitation and forgets its token", () => {
    const { forgetToken } = setup({ preview: { status: "expired" } });

    expect(screen.getByRole("heading", { name: "This invitation has expired" })).toBeInTheDocument();
    expect(screen.getByText("Ask alice to send you a new one.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
    expect(forgetToken).toHaveBeenCalled();
  });

  it("explains a revoked invitation and names the organization when the inviter is unknown", () => {
    setup({ preview: { status: "revoked", inviterName: null } });

    expect(screen.getByRole("heading", { name: "This invitation was revoked" })).toBeInTheDocument();
    expect(screen.getByText("Ask An admin of Acme Corp if you still need access to Acme Corp.")).toBeInTheDocument();
  });

  it("explains an invitation that was already accepted and offers the way into Console", () => {
    setup({ preview: { status: "accepted" } });

    expect(screen.getByRole("heading", { name: "This invitation was already accepted" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Console" })).toHaveAttribute("href", "/deployments");
  });

  it("holds the accept button while the session loads", () => {
    setup({ isSignedIn: false, isUserLoading: true });

    expect(screen.getByRole("button", { name: /Accept invitation/ })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it("joins the organization, forgets the token and switches into the organization", async () => {
    const { user, acceptInvitation, switchOrganization, enqueueSnackbar, forgetToken } = setup({});
    acceptInvitation.mockImplementation((input, options) => options?.onSuccess?.({ data: JOINED }, input, undefined));

    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(acceptInvitation.mock.lastCall?.[0]).toEqual({ data: { token: TOKEN } });
    expect(forgetToken).toHaveBeenCalled();
    expect(switchOrganization).toHaveBeenCalledWith("org-2");
    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "You joined Acme Corp", variant: "success" });
  });

  it("confirms the join in place when it cannot switch into the organization", async () => {
    const { user, acceptInvitation, switchOrganization } = setup({});
    switchOrganization.mockReturnValue(false);
    acceptInvitation.mockImplementation((input, options) => options?.onSuccess?.({ data: JOINED }, input, undefined));

    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(await screen.findByRole("heading", { name: "You joined Acme Corp" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Console" })).toHaveAttribute("href", "/deployments");
    expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
  });

  it("asks before joining with an email other than the invited one, then joins once confirmed", async () => {
    const { user, acceptInvitation, confirm, switchOrganization } = setup({});
    acceptInvitation.mockImplementation((input, options) =>
      input.data.confirmEmailMismatch
        ? options?.onSuccess?.({ data: JOINED }, input, undefined)
        : options?.onError?.(refusal(409, "invitation_email_mismatch"), input, undefined)
    );

    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() => expect(switchOrganization).toHaveBeenCalledWith("org-2"));
    expect(confirm).toHaveBeenCalledWith({
      title: "Join with a different email?",
      message: "This invitation was sent to bob@acme.io, but you're signed in as robert@home.io. Join Acme Corp with this account anyway?"
    });
    expect(acceptInvitation.mock.calls.map(([input]) => input)).toEqual([{ data: { token: TOKEN } }, { data: { token: TOKEN, confirmEmailMismatch: true } }]);
  });

  it("does not join when the email mismatch is not confirmed", async () => {
    const { user, acceptInvitation, confirm, switchOrganization, enqueueSnackbar, forgetToken } = setup({ isConfirmed: false, userEmail: null });
    acceptInvitation.mockImplementation((input, options) => options?.onError?.(refusal(409, "invitation_email_mismatch"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("you're signed in as another account") }))
    );
    expect(acceptInvitation).toHaveBeenCalledTimes(1);
    expect(switchOrganization).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(forgetToken).not.toHaveBeenCalled();
  });

  it("asks before joining with the invited address when the account has not verified it yet", async () => {
    const { user, acceptInvitation, confirm } = setup({ userEmail: " Bob@Acme.io " });
    acceptInvitation.mockImplementation((input, options) =>
      input.data.confirmEmailMismatch
        ? options?.onSuccess?.({ data: JOINED }, input, undefined)
        : options?.onError?.(refusal(409, "invitation_email_mismatch"), input, undefined)
    );

    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith({
        title: "Join before verifying your email?",
        message: "This invitation was sent to bob@acme.io, which this account has not verified yet. Join Acme Corp with this account anyway?"
      })
    );
  });

  it("reports a mismatch refused even after confirming instead of asking again", async () => {
    const { user, acceptInvitation, confirm, enqueueSnackbar } = setup({});
    acceptInvitation.mockImplementation((input, options) => options?.onError?.(refusal(409, "invitation_email_mismatch"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Couldn't accept the invitation. Try again in a moment.", variant: "error" });
  });

  it("tells a member they already belong to the organization and forgets the token", async () => {
    const { user, acceptInvitation, forgetToken, switchOrganization } = setup({});
    acceptInvitation.mockImplementation((input, options) => options?.onError?.(refusal(409, "already_member"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(await screen.findByRole("heading", { name: "You're already a member of Acme Corp" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Console" })).toHaveAttribute("href", "/deployments");
    expect(forgetToken).toHaveBeenCalled();
    expect(switchOrganization).not.toHaveBeenCalled();
  });

  it("explains that organizations are not available yet when accepting is not found for the account", async () => {
    const { user, acceptInvitation, forgetToken, enqueueSnackbar } = setup({});
    acceptInvitation.mockImplementation((input, options) => options?.onError?.(refusal(404, "not_found"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(await screen.findByRole("heading", { name: "Organizations aren't available for your account yet" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "This invitation link doesn't work" })).not.toBeInTheDocument();
    expect(forgetToken).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it.each([
    [410, "invitation_expired", "This invitation has expired."],
    [410, "invitation_revoked", "This invitation was revoked."],
    [409, "invitation_already_accepted", "This invitation has already been accepted."]
  ])("explains a %s %s refusal and forgets the token", async (status, code, message) => {
    const { user, acceptInvitation, confirm, enqueueSnackbar, forgetToken } = setup({});
    acceptInvitation.mockImplementation((input, options) => options?.onError?.(refusal(status, code), input, undefined));

    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() => expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: message, variant: "error" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(forgetToken).toHaveBeenCalled();
  });

  it("asks a caller without a session to sign in again and keeps the token", async () => {
    const { user, acceptInvitation, enqueueSnackbar, forgetToken } = setup({});
    acceptInvitation.mockImplementation((input, options) => options?.onError?.(refusal(403, "session_required"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Sign in again to accept this invitation.", variant: "error" });
    expect(forgetToken).not.toHaveBeenCalled();
  });

  function refusal(status: number, code: string) {
    return new ApiError(status, { code }, "POST /v1/invitations/accept");
  }

  function lastSnackbar(enqueueSnackbar: ReturnType<typeof vi.fn>) {
    const [element, options] = enqueueSnackbar.mock.lastCall as [{ props: { title: string } }, { variant: string }];
    return { title: element.props.title, variant: options.variant };
  }

  function setup(input: {
    token?: string | null;
    preview?: Partial<InvitationPreviewOutput> | null;
    error?: Error;
    isSignedIn?: boolean;
    isUserLoading?: boolean;
    userEmail?: string | null;
    isConfirmed?: boolean;
  }) {
    const preview: InvitationPreviewOutput | undefined =
      input.preview === null
        ? undefined
        : {
            organizationName: "Acme Corp",
            inviterName: "alice",
            role: "member",
            email: "bob@acme.io",
            status: "pending",
            expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
            ...input.preview
          };
    const token = "token" in input ? input.token : TOKEN;
    const forgetToken = vi.fn();
    const acceptInvitation = vi.fn<ReturnType<typeof DEPENDENCIES.useAcceptInvitationMutation>["mutate"]>();
    const switchOrganization = vi.fn<ReturnType<typeof DEPENDENCIES.useActiveOrganization>["switchOrganization"]>().mockReturnValue(true);
    const confirm = vi.fn<ReturnType<typeof DEPENDENCIES.usePopup>["confirm"]>(async () => input.isConfirmed ?? true);
    const enqueueSnackbar = vi.fn();
    const useInvitationPreviewQuery = vi.fn((_token: string | null | undefined) =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useInvitationPreviewQuery>>({ isError: !!input.error }), { data: preview, error: input.error ?? null })
    );
    const isSignedIn = input.isSignedIn ?? true;

    const dependencies: typeof DEPENDENCIES = {
      Layout: ({ children }) => <>{children}</>,
      useInvitationToken: () => ({ token, forgetToken }),
      useUser: () =>
        mock<ReturnType<typeof DEPENDENCIES.useUser>>({
          user: isSignedIn
            ? { id: "user-bob", userId: "auth0|bob", email: input.userEmail === null ? undefined : input.userEmail ?? "robert@home.io" }
            : undefined,
          isLoading: input.isUserLoading ?? false
        }),
      useActiveOrganization: () => mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ switchOrganization }),
      useInvitationPreviewQuery,
      useAcceptInvitationMutation: () => mock<ReturnType<typeof DEPENDENCIES.useAcceptInvitationMutation>>({ mutate: acceptInvitation, isPending: false }),
      usePopup: () => mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    render(<AcceptInvitationPage dependencies={dependencies} />);

    return { user: userEvent.setup(), acceptInvitation, switchOrganization, confirm, enqueueSnackbar, forgetToken, useInvitationPreviewQuery };
  }
});

const TOKEN = "t".repeat(43);

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
