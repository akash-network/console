"use client";
import type { FC } from "react";
import {
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  Snackbar
} from "@akashnetwork/ui/components";
import { formatDistanceStrict } from "date-fns";
import { Link2, Mail, MoreHorizontal, Send, Trash2 } from "lucide-react";
import { useSnackbar } from "notistack";

import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { getMembershipErrorMessage } from "@src/components/organizations/membershipErrorMessages";
import { ORGANIZATION_ROLE_LABELS } from "@src/components/organizations/organizationAccess";
import {
  useCreateOrganizationInvitationLinkMutation,
  useDeleteOrganizationInvitationMutation,
  useResendOrganizationInvitationMutation
} from "@src/queries/useOrganizationInvitationsQueries";
import type { OrganizationInvitationOutput } from "@src/types/organizationMembership";
import { copyPendingTextToClipboard } from "./copyPendingTextToClipboard";

export const DEPENDENCIES = {
  useSnackbar,
  useResendOrganizationInvitationMutation,
  useCreateOrganizationInvitationLinkMutation,
  useDeleteOrganizationInvitationMutation
};

type Props = {
  invitations: OrganizationInvitationOutput[] | undefined;
  isLoading: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const PendingInvitationList: FC<Props> = ({ invitations, isLoading, dependencies: d = DEPENDENCIES }) => {
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutate: resendInvitation } = d.useResendOrganizationInvitationMutation();
  const { mutateAsync: createInvitationLink } = d.useCreateOrganizationInvitationLinkMutation();
  const { mutate: deleteInvitation } = d.useDeleteOrganizationInvitationMutation();
  const now = new Date();

  const notifySuccess = (title: string, subTitle?: string) =>
    enqueueSnackbar(<Snackbar title={title} subTitle={subTitle} iconVariant="success" />, { variant: "success" });
  const notifyFailure = (title: string, subTitle?: string) =>
    enqueueSnackbar(<Snackbar title={title} subTitle={subTitle} iconVariant="error" />, { variant: "error" });

  const resend = (invitation: OrganizationInvitationOutput) =>
    resendInvitation(
      { id: invitation.id },
      {
        onSuccess: () => notifySuccess(`Invite resent to ${invitation.email}`),
        onError: error => notifyFailure(getMembershipErrorMessage(error, `Couldn't resend the invite to ${invitation.email}`))
      }
    );

  const copyLink = async (invitation: OrganizationInvitationOutput) => {
    const pendingUrl = createInvitationLink({ id: invitation.id }).then(response => response.data.url);

    try {
      if (await copyPendingTextToClipboard(pendingUrl)) {
        notifySuccess("Invite link copied", "The emailed link and earlier copied links no longer work.");
      } else {
        notifyFailure("Couldn't copy the invite link", await pendingUrl);
      }
    } catch (error) {
      notifyFailure(getMembershipErrorMessage(error, "Couldn't create an invite link"));
    }
  };

  const revoke = (invitation: OrganizationInvitationOutput) =>
    deleteInvitation(
      { id: invitation.id },
      {
        onSuccess: () => notifySuccess(`Invite to ${invitation.email} revoked`),
        onError: error => notifyFailure(getMembershipErrorMessage(error, `Couldn't revoke the invite to ${invitation.email}`))
      }
    );

  return (
    <SettingsSection
      title="Pending invitations"
      aside={invitations && <span className="whitespace-nowrap text-xs text-muted-foreground">{invitations.length} pending</span>}
    >
      <Card className="overflow-hidden rounded-xl shadow-none">
        {isLoading && <PendingInvitationSkeleton />}
        {invitations?.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No pending invitations.</p>}
        {!!invitations?.length && (
          <ul aria-label="Pending invitations" className="divide-y">
            {invitations.map(invitation => (
              <li key={invitation.id} className="flex items-center gap-3.5 px-4 py-3">
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-dashed bg-muted" aria-hidden>
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] font-medium">{invitation.email}</span>
                  <span className="truncate text-xs text-muted-foreground">{describeInvitationTiming(invitation, now)}</span>
                </div>
                <span className="w-[124px] shrink-0 px-3 text-sm">{ORGANIZATION_ROLE_LABELS[invitation.role]}</span>
                <div className="flex w-7 shrink-0 justify-end">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label={`Actions for the invite to ${invitation.email}`}
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-md text-muted-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => resend(invitation)}>
                        <Send className="mr-2 h-4 w-4" />
                        Resend invite
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => copyLink(invitation)}>
                        <Link2 className="mr-2 h-4 w-4" />
                        Copy invite link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => revoke(invitation)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Revoke invite
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </SettingsSection>
  );
};

const PendingInvitationSkeleton: FC = () => (
  <div className="flex items-center gap-3.5 px-4 py-4">
    <Skeleton className="h-[34px] w-[34px] rounded-full" />
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-56" />
    </div>
  </div>
);

function describeInvitationTiming(invitation: OrganizationInvitationOutput, now: Date): string {
  const invited = `Invited ${formatDistanceStrict(new Date(invitation.createdAt), now, { addSuffix: true })}`;
  const expiresAt = new Date(invitation.expiresAt);
  const expiry = expiresAt <= now ? "Expired" : `Expires ${formatDistanceStrict(expiresAt, now, { addSuffix: true })}`;
  return `${invited} · ${expiry}`;
}
