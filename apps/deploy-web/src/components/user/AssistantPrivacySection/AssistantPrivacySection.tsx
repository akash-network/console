"use client";
import type { FC } from "react";
import { useId } from "react";
import { Button, Snackbar, Switch } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { format } from "date-fns";
import { useSnackbar } from "notistack";

import { SettingsCard, SettingsRow } from "@src/components/layout/SettingsCard/SettingsCard";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { useFlag } from "@src/hooks/useFlag";
import { useAssistantPrivacyQuery, useDeleteAssistantConversationsMutation, useUpdateAssistantConsentMutation } from "@src/queries/useAssistantQueries";

export const DEPENDENCIES = {
  useFlag,
  usePopup,
  useSnackbar,
  useAssistantPrivacyQuery,
  useUpdateAssistantConsentMutation,
  useDeleteAssistantConversationsMutation
};

type Props = { dependencies?: typeof DEPENDENCIES };

export const AssistantPrivacySection: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const isEnabled = d.useFlag("user_feedback_loop");
  const privacy = d.useAssistantPrivacyQuery({ enabled: isEnabled });
  const { mutateAsync: updateConsent, isPending: isUpdating, variables } = d.useUpdateAssistantConsentMutation();
  const { mutateAsync: deleteConversations, isPending: isDeleting } = d.useDeleteAssistantConversationsMutation();
  const { confirm } = d.usePopup();
  const { enqueueSnackbar } = d.useSnackbar();
  const switchId = useId();

  if (!isEnabled || !privacy.data) return null;

  const { consent, storedConversationCount } = privacy.data;
  const isOptedIn = isUpdating && variables ? variables.data.reviewOptIn : !!consent?.reviewOptIn;

  const changeReviewOptIn = async (reviewOptIn: boolean) => {
    if (!consent) return;
    try {
      await updateConsent({ data: { copyVersion: consent.copyVersion, reviewOptIn } });
    } catch {
      enqueueSnackbar(<Snackbar title="Couldn't save your choice" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
    }
  };

  const deleteAll = async () => {
    const isConfirmed = await confirm({
      title: "Delete your saved conversations?",
      message: `This deletes ${conversationCountOf(storedConversationCount)} and removes them from the team's feedback reports. It can't be undone.`
    });
    if (!isConfirmed) return;

    try {
      const { data } = await deleteConversations();
      enqueueSnackbar(<Snackbar title={`Deleted ${conversationCountOf(data.deletedCount)}`} iconVariant="success" />, { variant: "success" });
    } catch {
      enqueueSnackbar(<Snackbar title="Couldn't delete your conversations" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
    }
  };

  return (
    <SettingsSection title="Privacy">
      <SettingsCard>
        <SettingsRow label="Improve Console with my assistant conversations" htmlFor={switchId} description={describeConsent(consent)}>
          <Switch id={switchId} checked={isOptedIn} disabled={!consent || isUpdating} onCheckedChange={changeReviewOptIn} />
        </SettingsRow>
        <SettingsRow
          label="Saved conversations"
          description={`${capitalize(conversationCountOf(storedConversationCount))}. Deleting also removes them from the team's feedback reports.`}
        >
          <Button
            type="button"
            variant="outline"
            size="md"
            className="border-destructive/60 text-destructive hover:text-destructive"
            disabled={storedConversationCount === 0 || isDeleting}
            onClick={deleteAll}
          >
            Delete all
          </Button>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
};

type Consent = NonNullable<NonNullable<ReturnType<typeof useAssistantPrivacyQuery>["data"]>["consent"]>;

function describeConsent(consent: Consent | null) {
  if (!consent) return "You haven't used the assistant yet. You can choose this the first time you open it.";

  return (
    <>
      The Akash team can read your saved conversations to find what to fix.
      <span className="mt-1 block font-mono text-xs">
        Agreed on {format(new Date(consent.processingAcceptedAt), "MMM d, yyyy")} · consent {consent.copyVersion}
      </span>
    </>
  );
}

function conversationCountOf(count: number): string {
  return count === 1 ? "1 conversation" : `${count} conversations`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
