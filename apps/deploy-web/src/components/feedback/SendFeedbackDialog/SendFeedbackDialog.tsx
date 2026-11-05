"use client";
import type { FC, FormEvent } from "react";
import { useId, useState } from "react";
import { extractApiErrorCode } from "@akashnetwork/openapi-sdk";
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
  Snackbar,
  Textarea,
  ToggleGroup,
  ToggleGroupItem
} from "@akashnetwork/ui/components";
import { usePathname } from "next/navigation";
import { useSnackbar } from "notistack";

import { useCreateFeedbackMutation } from "@src/queries/useFeedbackQueries";
import { MAX_FEEDBACK_MESSAGE_LENGTH } from "../DeploymentOutcomeCard/DeploymentOutcomeCard";
import { FEEDBACK_LIMIT_ERROR_CODE } from "../DeploymentOutcomePrompt/DeploymentOutcomePrompt";
import { FeedbackConsentNote } from "../FeedbackConsentNote/FeedbackConsentNote";

export const DEPENDENCIES = { useCreateFeedbackMutation, useSnackbar, usePathname };

type FeedbackCategory = "bug" | "feature_request" | "other";

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature_request", label: "Feature request" },
  { value: "other", label: "Other" }
];

type Props = {
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const SendFeedbackDialog: FC<Props> = ({ onClose, dependencies: d = DEPENDENCIES }) => {
  const { mutate: createFeedback, isPending: isSending } = d.useCreateFeedbackMutation();
  const { enqueueSnackbar } = d.useSnackbar();
  const page = d.usePathname() ?? undefined;
  const [category, setCategory] = useState<FeedbackCategory>();
  const [message, setMessage] = useState("");
  const formId = useId();
  const messageId = `${formId}-message`;
  const trimmedMessage = message.trim();
  const canSend = !!category && trimmedMessage.length > 0 && !isSending;

  const reportFailure = (error: unknown) => {
    const isOverLimit = extractApiErrorCode(error) === FEEDBACK_LIMIT_ERROR_CODE;
    enqueueSnackbar(
      <Snackbar
        title={isOverLimit ? "You've sent a lot of feedback today" : "Couldn't send your feedback"}
        subTitle={isOverLimit ? "Try again tomorrow." : "Try again in a moment."}
        iconVariant={isOverLimit ? "warning" : "error"}
      />,
      { variant: isOverLimit ? "warning" : "error" }
    );
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!canSend || !category) return;

    createFeedback(
      { data: { kind: "general", category, message: trimmedMessage, page } },
      {
        onSuccess: () => {
          enqueueSnackbar(
            <Snackbar title="Thanks, the team got your feedback" subTitle="We read every message, but we can't reply to each one." iconVariant="success" />,
            { variant: "success" }
          );
          onClose();
        },
        onError: reportFailure
      }
    );
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isSending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[520px]" hideCloseButton={isSending}>
        <DialogV2Header>
          <DialogV2Title>Send feedback</DialogV2Title>
          <DialogV2Description>Report a bug, ask for a feature, or tell us what&apos;s on your mind.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body>
          <form id={formId} className="flex flex-col gap-4" onSubmit={send}>
            <ToggleGroup
              type="single"
              role="radiogroup"
              aria-label="Feedback type"
              variant="outline"
              className="grid grid-cols-3 gap-2"
              value={category ?? ""}
              onValueChange={value => value && setCategory(value as FeedbackCategory)}
            >
              {CATEGORIES.map(({ value, label }) => (
                <ToggleGroupItem key={value} value={value} className="data-[state=on]:border-foreground data-[state=on]:bg-accent">
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={messageId}>Message</Label>
              <Textarea
                id={messageId}
                inputClassName="min-h-28"
                placeholder="What happened, or what would help?"
                maxLength={MAX_FEEDBACK_MESSAGE_LENGTH}
                rows={5}
                value={message}
                onChange={event => setMessage(event.target.value)}
              />
            </div>

            <FeedbackConsentNote sentWith="the page you're on" />
          </form>
        </DialogV2Body>

        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isSending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={formId} loading={isSending} disabled={!canSend}>
            Send feedback
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};
