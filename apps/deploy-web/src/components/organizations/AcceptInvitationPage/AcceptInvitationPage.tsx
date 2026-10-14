"use client";
import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";
import { Button, Card, CardContent, LoadingButton, Snackbar, Spinner } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { formatDistanceStrict } from "date-fns";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { getMembershipErrorMessage } from "@src/components/organizations/membershipErrorMessages";
import { OrganizationAvatar } from "@src/components/organizations/OrganizationAvatar/OrganizationAvatar";
import { describeRoleWithArticle } from "@src/components/organizations/organizationRoles";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useUser } from "@src/hooks/useUser";
import { useAcceptInvitationMutation, useInvitationPreviewQuery } from "@src/queries/useInvitationQueries";
import type { InvitationPreviewOutput } from "@src/types/organizationMembership";
import {
  ALREADY_MEMBER_ERROR_CODE,
  INVITATION_ALREADY_ACCEPTED_ERROR_CODE,
  INVITATION_EMAIL_MISMATCH_ERROR_CODE,
  INVITATION_EXPIRED_ERROR_CODE,
  INVITATION_REVOKED_ERROR_CODE
} from "@src/types/organizationMembership";
import { UrlService } from "@src/utils/urlUtils";
import { useInvitationToken } from "./useInvitationToken";

export const DEPENDENCIES = {
  Layout,
  useInvitationToken,
  useUser,
  useActiveOrganization,
  useInvitationPreviewQuery,
  useAcceptInvitationMutation,
  usePopup,
  useSnackbar
};

const SETTLED_INVITATION_ERROR_CODES = [INVITATION_EXPIRED_ERROR_CODE, INVITATION_REVOKED_ERROR_CODE, INVITATION_ALREADY_ACCEPTED_ERROR_CODE];

const NOT_FOUND_STATUS = 404;

/** The preview answers 400 for a malformed token and 404 for an unknown one; any other failure may pass on a retry. */
const UNREADABLE_LINK_STATUSES = [400, NOT_FOUND_STATUS];

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export function AcceptInvitationPage({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { token, forgetToken } = d.useInvitationToken();
  const preview = d.useInvitationPreviewQuery(token);
  const isUnreadable = token === null || (isApiError(preview.error) && UNREADABLE_LINK_STATUSES.includes(preview.error.status));
  const isSettled = isUnreadable || (!!preview.data && preview.data.status !== "pending");

  useEffect(
    function forgetSettledInvitation() {
      if (isSettled) forgetToken();
    },
    [isSettled, forgetToken]
  );

  return (
    <d.Layout>
      <NextSeo title="Organization invitation" noindex nofollow />

      <Card className="mx-auto mt-10 max-w-lg rounded-xl shadow-none">
        <CardContent className="flex flex-col gap-4 p-6">
          {isUnreadable && (
            <InvitationNotice title="This invitation link doesn't work">
              Open the link from the invitation email again, or ask the person who invited you to send a new one.
            </InvitationNotice>
          )}
          {!isUnreadable && preview.isError && (
            <InvitationNotice title="Couldn't load this invitation">Check your connection and reload the page.</InvitationNotice>
          )}
          {!isUnreadable && !preview.isError && !preview.data && (
            <div className="flex justify-center py-6" role="status" aria-label="Loading the invitation">
              <Spinner />
            </div>
          )}
          {!isUnreadable && !preview.isError && preview.data && token && (
            <InvitationView invitation={preview.data} token={token} onSettled={forgetToken} dependencies={d} />
          )}
        </CardContent>
      </Card>
    </d.Layout>
  );
}

type InvitationViewProps = {
  invitation: InvitationPreviewOutput;
  token: string;
  onSettled: () => void;
  dependencies: typeof DEPENDENCIES;
};

const InvitationView: FC<InvitationViewProps> = ({ invitation, token, onSettled, dependencies: d }) => {
  const inviter = invitation.inviterName ?? `An admin of ${invitation.organizationName}`;

  if (invitation.status === "expired") {
    return <InvitationNotice title="This invitation has expired">Ask {inviter} to send you a new one.</InvitationNotice>;
  }

  if (invitation.status === "revoked") {
    return (
      <InvitationNotice title="This invitation was revoked">
        Ask {inviter} if you still need access to {invitation.organizationName}.
      </InvitationNotice>
    );
  }

  if (invitation.status === "accepted") {
    return (
      <InvitationNotice title="This invitation was already accepted">
        If you accepted it, {invitation.organizationName} is in your organization switcher.
        <OpenConsoleButton />
      </InvitationNotice>
    );
  }

  return <PendingInvitation invitation={invitation} token={token} onSettled={onSettled} dependencies={d} />;
};

type Outcome = "alreadyMember" | "unavailable" | "joined";

const PendingInvitation: FC<InvitationViewProps> = ({ invitation, token, onSettled, dependencies: d }) => {
  const { user, isLoading: isUserLoading } = d.useUser();
  const { switchOrganization } = d.useActiveOrganization();
  const { mutate: acceptInvitation, isPending } = d.useAcceptInvitationMutation();
  const { confirm } = d.usePopup();
  const { enqueueSnackbar } = d.useSnackbar();
  const [outcome, setOutcome] = useState<Outcome>();
  const isSignedIn = !!user?.userId;
  const invitedBy = invitation.inviterName ? `${invitation.inviterName} invited you` : "You're invited";

  const notifyFailure = (title: string) => enqueueSnackbar(<Snackbar title={title} iconVariant="error" />, { variant: "error" });

  const confirmEmailMismatch = () =>
    confirm(
      isSameAddress(user?.email, invitation.email)
        ? {
            title: "Join before verifying your email?",
            message: `This invitation was sent to ${invitation.email}, which this account has not verified yet. Join ${invitation.organizationName} with this account anyway?`
          }
        : {
            title: "Join with a different email?",
            message: `This invitation was sent to ${invitation.email}, but you're signed in as ${user?.email ?? "another account"}. Join ${invitation.organizationName} with this account anyway?`
          }
    );

  const handleRefusal = async (error: unknown, isMismatchConfirmed: boolean) => {
    const code = extractApiErrorCode(error);
    if (code === INVITATION_EMAIL_MISMATCH_ERROR_CODE && !isMismatchConfirmed) {
      if (await confirmEmailMismatch()) accept(true);
    } else if (code === ALREADY_MEMBER_ERROR_CODE) {
      onSettled();
      setOutcome("alreadyMember");
    } else if (isApiError(error) && error.status === NOT_FOUND_STATUS) {
      setOutcome("unavailable");
    } else {
      if (code && SETTLED_INVITATION_ERROR_CODES.includes(code)) onSettled();
      notifyFailure(getMembershipErrorMessage(error, "Couldn't accept the invitation. Try again in a moment."));
    }
  };

  const accept = (isMismatchConfirmed: boolean) =>
    acceptInvitation(
      { data: isMismatchConfirmed ? { token, confirmEmailMismatch: true } : { token } },
      {
        onSuccess: ({ data: joined }) => {
          onSettled();
          enqueueSnackbar(<Snackbar title={`You joined ${joined.name}`} iconVariant="success" />, { variant: "success" });
          if (!switchOrganization(joined.id)) setOutcome("joined");
        },
        onError: error => handleRefusal(error, isMismatchConfirmed)
      }
    );

  if (outcome === "joined") {
    return (
      <InvitationNotice title={`You joined ${invitation.organizationName}`}>
        Pick it from the organization switcher to start working in it.
        <OpenConsoleButton />
      </InvitationNotice>
    );
  }

  if (outcome === "alreadyMember") {
    return (
      <InvitationNotice title={`You're already a member of ${invitation.organizationName}`}>
        Switch to it from the organization switcher.
        <OpenConsoleButton />
      </InvitationNotice>
    );
  }

  if (outcome === "unavailable") {
    return (
      <InvitationNotice title="Organizations aren't available for your account yet">
        Your invitation stays valid until it expires, so open this link again later.
      </InvitationNotice>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <OrganizationAvatar organization={{ name: invitation.organizationName, type: "team" }} size={40} />
        <h1 className="text-lg font-semibold">Join {invitation.organizationName}</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        {invitedBy} to join <strong className="text-foreground">{invitation.organizationName}</strong> on Akash Console as{" "}
        {describeRoleWithArticle(invitation.role)}.
      </p>
      <p className="font-mono text-[11px] text-muted-foreground">
        Sent to {invitation.email} · Expires {formatDistanceStrict(new Date(invitation.expiresAt), new Date(), { addSuffix: true })}
      </p>

      {isSignedIn || isUserLoading ? (
        <LoadingButton className="w-full" loading={isPending || isUserLoading} disabled={isPending || isUserLoading} onClick={() => accept(false)}>
          Accept invitation
        </LoadingButton>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href={UrlService.newSignup({ returnTo: UrlService.invitations() })}>Sign up to accept</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={UrlService.newLogin({ returnTo: UrlService.invitations() })}>Log in</Link>
          </Button>
        </div>
      )}
    </>
  );
};

function isSameAddress(signedInEmail: string | null | undefined, invitedEmail: string): boolean {
  return !!signedInEmail && signedInEmail.trim().toLowerCase() === invitedEmail.trim().toLowerCase();
}

const OpenConsoleButton: FC = () => (
  <Button asChild className="mt-4 w-full">
    <Link href={UrlService.home()}>Open Console</Link>
  </Button>
);

const InvitationNotice: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-2">
    <h1 className="text-lg font-semibold">{title}</h1>
    <div className="text-sm text-muted-foreground">{children}</div>
  </div>
);
