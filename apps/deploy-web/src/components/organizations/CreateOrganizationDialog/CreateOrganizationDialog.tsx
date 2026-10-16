"use client";
import type { FC, FormEvent } from "react";
import { useId, useRef, useState } from "react";
import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Input,
  Label,
  LoadingButton,
  Snackbar
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Info } from "lucide-react";
import { useSnackbar } from "notistack";

import type { NewCardHandle } from "@src/components/organizations/NewCardFields/NewCardFields";
import { CARD_SAVE_FAILED_REASON } from "@src/components/organizations/NewCardFields/NewCardFields";
import type { BillingChoice } from "@src/components/organizations/OrganizationBillingField/OrganizationBillingField";
import { OrganizationBillingField } from "@src/components/organizations/OrganizationBillingField/OrganizationBillingField";
import { SUPPORT_EMAIL } from "@src/config/ui.config";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import { serializeActiveOrganizationCookie } from "@src/lib/active-organization/active-organization-cookie";
import { useCreateOrganizationInvitationsMutation, useCreateOrganizationMutation } from "@src/queries/useOrganizationQueries";
import { ORGANIZATION_LIMIT_REACHED_ERROR_CODE, ORGANIZATION_NAME_TAKEN_ERROR_CODE } from "@src/types/organization";
import { readRefusedLimit } from "@src/utils/refusedLimit";
import { UrlService } from "@src/utils/urlUtils";
import { INVALID_EMAIL_MESSAGE, isEmailAddress } from "../emailAddress";
import { EmailChipsInput } from "../EmailChipsInput/EmailChipsInput";

export const DEPENDENCIES = {
  useActiveOrganization,
  useUser,
  useCreateOrganizationMutation,
  useCreateOrganizationInvitationsMutation,
  useSnackbar,
  OrganizationBillingField
};

export const ORGANIZATION_NAME_TAKEN_MESSAGE = "You already belong to an organization with this name.";

export const INVALID_ORGANIZATION_NAME_MESSAGE = "This name can't be used. Try another one.";

export const OWN_EMAIL_MESSAGE = "That's your address";

export const MAX_ORGANIZATION_NAME_LENGTH = 64;

const INVITE_HINT = "They join as Members. You can change roles later.";

const OWNER_NOTE = "You'll be the organization's owner.";

const BAD_REQUEST_STATUS = 400;

type Refusal = { name?: string; form?: string };

type Props = {
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const CreateOrganizationDialog: FC<Props> = ({ onClose, dependencies: d = DEPENDENCIES }) => {
  const { organizations, switchOrganization } = d.useActiveOrganization();
  const { user } = d.useUser();
  const { enqueueSnackbar } = d.useSnackbar();
  const { stripe, errorHandler } = useServices();
  const { mutateAsync: createOrganization } = d.useCreateOrganizationMutation();
  const { mutateAsync: inviteToActiveOrganization } = d.useCreateOrganizationInvitationsMutation();
  const [name, setName] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [refusal, setRefusal] = useState<Refusal>({});
  const [billingChoice, setBillingChoice] = useState<BillingChoice>();
  const [isCardComplete, setIsCardComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cardRef = useRef<NewCardHandle>(null);
  const formId = useId();
  const nameId = `${formId}-name`;
  const nameErrorId = `${formId}-name-error`;
  const emailsId = `${formId}-emails`;
  const inviteHintId = `${formId}-invite-hint`;

  const trimmedName = name.trim();
  const isNameTaken = organizations.some(organization => organization.name.trim().toLowerCase() === trimmedName.toLowerCase());
  const nameError = isNameTaken ? ORGANIZATION_NAME_TAKEN_MESSAGE : refusal.name;
  const ownEmail = user?.email?.toLowerCase();
  const getEmailError = (email: string) => (!isEmailAddress(email) ? INVALID_EMAIL_MESSAGE : email === ownEmail ? OWN_EMAIL_MESSAGE : null);
  const firstBadEmail = emails.find(email => getEmailError(email));
  const isBillingChosen = billingChoice === "later" || isCardComplete;
  const canSubmit = trimmedName.length > 0 && !nameError && !firstBadEmail && isBillingChosen && !isSubmitting;

  const typeName = (value: string) => {
    setName(value);
    setRefusal({});
  };

  const chooseBilling = (choice: BillingChoice) => {
    setBillingChoice(choice);
    setIsCardComplete(false);
  };

  const reportRefusal = (error: unknown) => {
    const code = extractApiErrorCode(error);
    if (code === ORGANIZATION_NAME_TAKEN_ERROR_CODE) {
      setRefusal({ name: ORGANIZATION_NAME_TAKEN_MESSAGE });
    } else if (code === ORGANIZATION_LIMIT_REACHED_ERROR_CODE) {
      setRefusal({ form: describeOrganizationLimit(readRefusedLimit(error)) });
    } else if (isApiError(error) && error.status === BAD_REQUEST_STATUS) {
      setRefusal({ name: INVALID_ORGANIZATION_NAME_MESSAGE });
    } else {
      enqueueSnackbar(<Snackbar title="Couldn't create the organization" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
    }
  };

  const reportUnsentInvitations = () => {
    enqueueSnackbar(<Snackbar title="Your invitations weren't sent" subTitle="Invite your teammates from the Members page." iconVariant="warning" />, {
      variant: "warning"
    });
  };

  const inviteTeammates = async () => {
    try {
      await inviteToActiveOrganization({ data: { emails, role: "member" } });
    } catch {
      reportUnsentInvitations();
    }
  };

  const reportCreated = (organizationName: string, cardFailure: string | undefined) => {
    if (cardFailure) {
      enqueueSnackbar(
        <Snackbar
          title={`Created ${organizationName}, but your card wasn't saved`}
          subTitle={`${cardFailure} You can add a card in Billing.`}
          iconVariant="warning"
        />,
        { variant: "warning" }
      );
    } else {
      enqueueSnackbar(<Snackbar title={`Created ${organizationName}`} iconVariant="success" />, { variant: "success" });
    }
  };

  const reportBillingError = (error: unknown) => errorHandler.reportError({ error, tags: { category: "billing" } });

  const confirmCard = async (card: NewCardHandle) => {
    try {
      const { clientSecret } = await stripe.createSetupIntent();
      return await card.save(clientSecret);
    } catch (error) {
      reportBillingError(error);
      return CARD_SAVE_FAILED_REASON;
    }
  };

  /** The API files a team's new card, and makes its first one the default, when a member next reads the team's cards. */
  const recordCardAsDefault = () => stripe.getPaymentMethods().catch(reportBillingError);

  /** The proxy reads the organization of every request from its cookie only, so this saves the card on the new team's own customer. */
  const saveCardToOrganization = async (card: NewCardHandle, organizationId: string) => {
    document.cookie = serializeActiveOrganizationCookie(organizationId);
    const cardFailure = await confirmCard(card);
    if (!cardFailure) await recordCardAsDefault();

    return cardFailure;
  };

  const createAndEnterOrganization = async () => {
    const card = cardRef.current;
    if (card && !(await card.validate())) return;

    const created = await createOrganization({ data: { name: trimmedName } }).then(
      response => response.data,
      error => {
        reportRefusal(error);
        return undefined;
      }
    );
    if (!created) return;

    const cardFailure = card ? await saveCardToOrganization(card, created.id) : undefined;
    reportCreated(created.name, cardFailure);
    const hasSwitched = switchOrganization(created.id, { destination: UrlService.members() });
    onClose();

    if (!emails.length) return;
    if (hasSwitched) {
      await inviteTeammates();
    } else {
      reportUnsentInvitations();
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await createAndEnterOrganization();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isSubmitting ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[520px]" hideCloseButton={isSubmitting}>
        <DialogV2Header>
          <DialogV2Title>Create an organization</DialogV2Title>
          <DialogV2Description>Share projects, deployments and billing with your team.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body>
          <form id={formId} className="flex flex-col gap-4" onSubmit={submit}>
            <div className="flex flex-col gap-1.5">
              <Input
                id={nameId}
                label="Organization name"
                placeholder="Acme Corp"
                autoFocus
                maxLength={MAX_ORGANIZATION_NAME_LENGTH}
                value={name}
                error={!!nameError}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? nameErrorId : undefined}
                onChange={event => typeName(event.target.value)}
              />
              {nameError && (
                <p id={nameErrorId} role="alert" className="text-xs text-destructive">
                  {nameError}
                </p>
              )}
            </div>

            <d.OrganizationBillingField
              organizationName={trimmedName}
              choice={billingChoice}
              onChoiceChange={chooseBilling}
              cardRef={cardRef}
              onCardCompleteChange={setIsCardComplete}
              disabled={isSubmitting}
            />

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor={emailsId}>Invite teammates</Label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <EmailChipsInput id={emailsId} emails={emails} onChange={setEmails} getError={getEmailError} aria-describedby={inviteHintId} />
              <p id={inviteHintId} className={cn("text-xs", firstBadEmail ? "text-destructive" : "text-muted-foreground")}>
                {firstBadEmail ? `${firstBadEmail}: ${getEmailError(firstBadEmail)}` : INVITE_HINT}
              </p>
            </div>

            {refusal.form && (
              <p role="alert" className="text-xs text-destructive">
                {refusal.form}
              </p>
            )}

            <div className="flex items-start gap-2 rounded-[10px] border border-border bg-card px-3.5 py-3 text-[12.5px] leading-[18px] text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{OWNER_NOTE}</span>
            </div>
          </form>
        </DialogV2Body>

        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={formId} loading={isSubmitting} disabled={!canSubmit}>
            Create organization
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};

function describeOrganizationLimit(limit: number | undefined) {
  const reached = limit ? `You've reached your limit of ${limit} organizations.` : "You've reached the number of organizations you can create.";

  return `${reached} Contact ${SUPPORT_EMAIL} if you need more.`;
}
