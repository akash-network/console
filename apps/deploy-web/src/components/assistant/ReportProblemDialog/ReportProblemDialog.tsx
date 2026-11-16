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
  Textarea
} from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { ASSISTANT_REPORT_CONSENT_COPY } from "../assistantReportConsentCopy";

export const DEPENDENCIES = { useSnackbar };

export const MAX_PROBLEM_REPORT_NOTE_LENGTH = 2_000;

export const REPORT_LIMIT_ERROR_CODE = "assistant_report_limit";

const FAILURE_MESSAGES = {
  limit: "You've sent a lot of reports today. Try again tomorrow.",
  other: "Couldn't send your report. Try again in a moment."
};

type Props = {
  onSend: (note: string) => Promise<void>;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const ReportProblemDialog: FC<Props> = ({ onSend, onClose, dependencies: d = DEPENDENCIES }) => {
  const { enqueueSnackbar } = d.useSnackbar();
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const formId = useId();
  const noteId = `${formId}-note`;

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (isSending) return;

    setIsSending(true);
    setFailure(null);
    try {
      await onSend(note);
      enqueueSnackbar(<Snackbar title="Thanks, the team got your report" subTitle="We'll look into what went wrong." iconVariant="success" />, {
        variant: "success"
      });
      onClose();
    } catch (error) {
      setFailure(extractApiErrorCode(error) === REPORT_LIMIT_ERROR_CODE ? FAILURE_MESSAGES.limit : FAILURE_MESSAGES.other);
      setIsSending(false);
    }
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isSending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[480px]" hideCloseButton={isSending}>
        <DialogV2Header>
          <DialogV2Title>Report a problem</DialogV2Title>
          <DialogV2Description>Tell us what went wrong with this answer. The note is optional.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body>
          <form id={formId} className="flex flex-col gap-4" onSubmit={send}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={noteId}>What went wrong?</Label>
              <Textarea
                id={noteId}
                inputClassName="min-h-24"
                placeholder="For example, it suggested a setting that doesn't exist"
                maxLength={MAX_PROBLEM_REPORT_NOTE_LENGTH}
                rows={4}
                value={note}
                onChange={event => setNote(event.target.value)}
              />
            </div>

            <p className="text-xs text-muted-foreground">{ASSISTANT_REPORT_CONSENT_COPY.line}</p>

            {failure && (
              <p role="alert" className="text-sm text-destructive">
                {failure}
              </p>
            )}
          </form>
        </DialogV2Body>

        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isSending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={formId} loading={isSending} disabled={isSending}>
            Send report
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};
