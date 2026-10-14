"use client";
import type { FC, FormEvent } from "react";
import { useId, useState } from "react";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Label,
  LoadingButton,
  RadioGroup,
  RadioGroupItem,
  Snackbar
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { useSnackbar } from "notistack";

import { INVALID_EMAIL_MESSAGE, isEmailAddress } from "@src/components/organizations/emailAddress";
import { EmailChipsInput } from "@src/components/organizations/EmailChipsInput/EmailChipsInput";
import { getMembershipErrorMessage } from "@src/components/organizations/membershipErrorMessages";
import { ORGANIZATION_ROLE_LABELS } from "@src/components/organizations/organizationAccess";
import type { AssignableRole } from "@src/components/organizations/organizationRoles";
import { ASSIGNABLE_ROLE_DESCRIPTIONS, ASSIGNABLE_ROLES } from "@src/components/organizations/organizationRoles";
import { useCreateOrganizationInvitationsMutation } from "@src/queries/useOrganizationQueries";

export const DEPENDENCIES = { useCreateOrganizationInvitationsMutation, useSnackbar };

export const ALREADY_MEMBER_MESSAGE = "Already a member";

export const ALREADY_INVITED_MESSAGE = "Already invited";

const EMAILS_HINT = "Separate multiple addresses with commas or spaces.";

type Props = {
  organizationName: string;
  memberEmails: string[];
  invitedEmails: string[];
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const InviteMembersDialog: FC<Props> = ({ organizationName, memberEmails, invitedEmails, onClose, dependencies: d = DEPENDENCIES }) => {
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutate: createInvitations, isPending } = d.useCreateOrganizationInvitationsMutation();
  const [emails, setEmails] = useState<string[]>([]);
  const [role, setRole] = useState<AssignableRole>("member");
  const formId = useId();
  const emailsId = `${formId}-emails`;
  const hintId = `${formId}-hint`;

  const knownMembers = new Set(memberEmails.map(email => email.toLowerCase()));
  const knownInvitees = new Set(invitedEmails.map(email => email.toLowerCase()));
  const getEmailError = (email: string) => {
    if (!isEmailAddress(email)) return INVALID_EMAIL_MESSAGE;
    if (knownMembers.has(email)) return ALREADY_MEMBER_MESSAGE;
    if (knownInvitees.has(email)) return ALREADY_INVITED_MESSAGE;
    return null;
  };
  const firstBadEmail = emails.find(email => getEmailError(email));
  const canSubmit = emails.length > 0 && !firstBadEmail && !isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    createInvitations(
      { data: { emails, role } },
      {
        onSuccess: () => {
          const title = emails.length === 1 ? `Invite sent to ${emails[0]}` : `${emails.length} invites sent`;
          enqueueSnackbar(<Snackbar title={title} iconVariant="success" />, { variant: "success" });
          onClose();
        },
        onError: error => {
          const title = getMembershipErrorMessage(error, "Couldn't send the invites");
          enqueueSnackbar(<Snackbar title={title} iconVariant="error" />, { variant: "error" });
        }
      }
    );
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isPending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[520px]" hideCloseButton={isPending}>
        <DialogV2Header>
          <DialogV2Title>Invite to {organizationName}</DialogV2Title>
          <DialogV2Description>Invitations expire after 7 days.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body>
          <form id={formId} className="flex flex-col gap-4" onSubmit={submit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={emailsId}>Email addresses</Label>
              <EmailChipsInput id={emailsId} emails={emails} onChange={setEmails} getError={getEmailError} autoFocus aria-describedby={hintId} />
              <p id={hintId} className={cn("text-xs", firstBadEmail ? "text-destructive" : "text-muted-foreground")}>
                {firstBadEmail ? `${firstBadEmail}: ${getEmailError(firstBadEmail)}` : EMAILS_HINT}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label id={`${formId}-role`}>Role</Label>
              <RadioGroup
                aria-labelledby={`${formId}-role`}
                value={role}
                onValueChange={value => setRole(value as AssignableRole)}
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                {ASSIGNABLE_ROLES.map(option => (
                  <Label
                    key={option}
                    htmlFor={`${formId}-role-${option}`}
                    className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-border p-3 font-normal has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-muted/40"
                  >
                    <RadioGroupItem id={`${formId}-role-${option}`} value={option} className="mt-0.5 shrink-0" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">{ORGANIZATION_ROLE_LABELS[option]}</span>
                      <span className="text-xs leading-[17px] text-muted-foreground">{ASSIGNABLE_ROLE_DESCRIPTIONS[option]}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          </form>
        </DialogV2Body>

        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={formId} loading={isPending} disabled={!canSubmit}>
            {emails.length > 1 ? `Send ${emails.length} invites` : "Send invite"}
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};
