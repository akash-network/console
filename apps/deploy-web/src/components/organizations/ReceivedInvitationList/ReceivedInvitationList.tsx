"use client";
import { buttonVariants, DropdownMenuItem, Snackbar } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { cn } from "@akashnetwork/ui/utils";
import { formatDistanceStrict } from "date-fns";
import { useSnackbar } from "notistack";

import { getMembershipErrorMessage } from "@src/components/organizations/membershipErrorMessages";
import { OrganizationAvatar } from "@src/components/organizations/OrganizationAvatar/OrganizationAvatar";
import { describeRoleWithArticle } from "@src/components/organizations/organizationRoles";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useAcceptReceivedInvitationMutation, useDeclineReceivedInvitationMutation } from "@src/queries/useInvitationQueries";
import type { ReceivedInvitationOutput } from "@src/types/organizationMembership";

export const DEPENDENCIES = {
  useAcceptReceivedInvitationMutation,
  useDeclineReceivedInvitationMutation,
  useActiveOrganization,
  usePopup,
  useSnackbar
};

type Props = {
  invitations: ReceivedInvitationOutput[];
  dependencies?: typeof DEPENDENCIES;
};

/** Renders inside a dropdown menu, so its answers are menu items the arrow keys reach. */
export function ReceivedInvitationList({ invitations, dependencies: d = DEPENDENCIES }: Props) {
  const { mutate: acceptInvitation } = d.useAcceptReceivedInvitationMutation();
  const { mutate: declineInvitation } = d.useDeclineReceivedInvitationMutation();
  const { switchOrganization } = d.useActiveOrganization();
  const { confirm } = d.usePopup();
  const { enqueueSnackbar } = d.useSnackbar();

  const notifySuccess = (title: string) => enqueueSnackbar(<Snackbar title={title} iconVariant="success" />, { variant: "success" });
  const notifyFailure = (error: unknown, fallback: string) =>
    enqueueSnackbar(<Snackbar title={getMembershipErrorMessage(error, fallback)} iconVariant="error" />, { variant: "error" });

  const accept = (invitation: ReceivedInvitationOutput) =>
    acceptInvitation(
      { id: invitation.id },
      {
        onSuccess: ({ data: joined }) => {
          notifySuccess(`You joined ${joined.name}`);
          switchOrganization(joined.id);
        },
        onError: error => notifyFailure(error, `Couldn't join ${invitation.organizationName}. Try again in a moment.`)
      }
    );

  const decline = async (invitation: ReceivedInvitationOutput) => {
    const isConfirmed = await confirm({
      title: `Decline the invitation to ${invitation.organizationName}?`,
      message: "To join later, you'll need a new invitation."
    });
    if (!isConfirmed) return;

    declineInvitation(
      { id: invitation.id },
      {
        onSuccess: () => notifySuccess(`You declined the invitation to ${invitation.organizationName}`),
        onError: error => notifyFailure(error, `Couldn't decline the invitation to ${invitation.organizationName}. Try again in a moment.`)
      }
    );
  };

  return (
    <ul aria-label="Invitations" className="py-1">
      {invitations.map(invitation => (
        <li key={invitation.id} className="flex items-start gap-3 px-4 py-2.5">
          <OrganizationAvatar organization={{ id: invitation.organizationId, name: invitation.organizationName, type: "team" }} size={28} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm">
              {invitation.inviterName ? `${invitation.inviterName} invited you` : "You're invited"} to join{" "}
              <strong className="font-medium">{invitation.organizationName}</strong> as {describeRoleWithArticle(invitation.role)}
            </p>
            <p className="text-xs text-muted-foreground">Expires {formatDistanceStrict(new Date(invitation.expiresAt), new Date(), { addSuffix: true })}</p>
            <div className="mt-1.5 flex gap-2">
              <DropdownMenuItem
                aria-label={`Accept the invitation to ${invitation.organizationName}`}
                className={cn(buttonVariants({ size: "xs" }), "cursor-pointer focus:bg-primary/90 focus:text-primary-foreground")}
                onSelect={() => accept(invitation)}
              >
                Accept
              </DropdownMenuItem>
              <DropdownMenuItem
                aria-label={`Decline the invitation to ${invitation.organizationName}`}
                className={cn(buttonVariants({ size: "xs", variant: "outline" }), "cursor-pointer")}
                onSelect={() => decline(invitation)}
              >
                Decline
              </DropdownMenuItem>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
