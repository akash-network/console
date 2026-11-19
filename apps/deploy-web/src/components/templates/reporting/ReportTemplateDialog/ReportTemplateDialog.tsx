"use client";
import type { FC, FormEvent } from "react";
import { useId, useState } from "react";
import {
  Alert,
  AlertDescription,
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
  Textarea
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { CircleCheck, Flag, Info, ShieldCheck } from "lucide-react";

import { useReportTemplateMutation } from "@src/queries/useUserTemplateQueries";
import type { TemplateReportReason } from "@src/types/marketplace-template";
import type { ReportRefusal } from "../readReportRefusal";
import { readReportRefusal } from "../readReportRefusal";
import { MAX_REPORT_DETAILS_LENGTH, REPORT_REASONS } from "../reportReasons";

export const DEPENDENCIES = {
  useReportTemplateMutation
};

export type ReportedTemplate = {
  id: string;
  title: string;
  currentVersion: { version: number } | null;
  publisher: { name: string } | null;
};

export interface ReportTemplateDialogProps {
  template: ReportedTemplate;
  onClose: () => void;
  /** The session ended while the dialog was open, so the report can only be sent after signing in again. */
  onSignedOut: () => void;
  /** The template was removed while the dialog was open, so the page behind it is out of date. */
  onTemplateRemoved: () => void;
  dependencies?: typeof DEPENDENCIES;
}

type Outcome = { tone: "done" | "notice"; title: string; message: string };

const FALLBACK_PUBLISHER = "The publisher";

export const ReportTemplateDialog: FC<ReportTemplateDialogProps> = ({ template, onClose, onSignedOut, onTemplateRemoved, dependencies: d = DEPENDENCIES }) => {
  const { mutateAsync: sendReport, isPending: isSending } = d.useReportTemplateMutation();
  const [reason, setReason] = useState<TemplateReportReason>();
  const [details, setDetails] = useState("");
  const [failure, setFailure] = useState<string>();
  const [outcome, setOutcome] = useState<Outcome>();
  const formId = useId();
  const reasonLabelId = useId();
  const detailsId = useId();
  const detailsHintId = useId();
  const publisherName = template.publisher?.name ?? FALLBACK_PUBLISHER;
  const reportedVersion = template.currentVersion ? `v${template.currentVersion.version}` : undefined;

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason || isSending) return;
    setFailure(undefined);

    try {
      await sendReport({ id: template.id, data: { reason, details: details.trim() || undefined } });
      setOutcome({
        tone: "done",
        title: "Thanks, your report was sent",
        message: `Akash staff will look at it. ${publisherName} is not told who reported the template.`
      });
    } catch (error) {
      const refusal = readReportRefusal(error);
      if (refusal?.kind === "signed_out") {
        onSignedOut();
        return;
      }
      if (refusal?.kind === "removed") onTemplateRemoved();

      const finalOutcome = outcomeOf(refusal, reportedVersion);
      if (finalOutcome) {
        setOutcome(finalOutcome);
        return;
      }
      setFailure(describeFailure(refusal));
    }
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isSending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-xl" hideCloseButton={isSending}>
        <DialogV2Header>
          <DialogV2Title>Report template</DialogV2Title>
          <DialogV2Description className="break-words">
            {[template.title, reportedVersion, template.publisher && `by ${template.publisher.name}`].filter(Boolean).join(" · ")}
          </DialogV2Description>
        </DialogV2Header>

        {outcome ? (
          <>
            <DialogV2Body>
              <div role="status" className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-4">
                {outcome.tone === "done" ? (
                  <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-500" aria-hidden="true" />
                ) : (
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{outcome.title}</p>
                  <p className="mt-1 break-words text-[13px] text-muted-foreground">{outcome.message}</p>
                </div>
              </div>
            </DialogV2Body>
            <DialogV2Footer className="flex items-center justify-end gap-2">
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            </DialogV2Footer>
          </>
        ) : (
          <>
            <DialogV2Body>
              <form id={formId} className="flex flex-col gap-5" onSubmit={send}>
                <div className="flex flex-col gap-2">
                  <p id={reasonLabelId} className="text-sm font-semibold">
                    What&apos;s wrong?
                  </p>
                  <RadioGroup
                    aria-labelledby={reasonLabelId}
                    value={reason ?? ""}
                    onValueChange={value => setReason(value as TemplateReportReason)}
                    disabled={isSending}
                    className="gap-0 divide-y divide-border overflow-hidden rounded-xl border border-border"
                  >
                    {REPORT_REASONS.map(option => (
                      <ReasonOption key={option.reason} {...option} isSelected={option.reason === reason} />
                    ))}
                  </RadioGroup>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={detailsId} className="flex items-baseline gap-1.5 text-sm font-semibold">
                    Details <span className="text-[13px] font-normal text-muted-foreground">Optional</span>
                  </Label>
                  <Textarea
                    id={detailsId}
                    aria-describedby={detailsHintId}
                    inputClassName="min-h-24"
                    rows={4}
                    maxLength={MAX_REPORT_DETAILS_LENGTH}
                    disabled={isSending}
                    value={details}
                    onChange={event => setDetails(event.target.value)}
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-muted-foreground">
                    <p id={detailsHintId}>Links and file paths help us check faster.</p>
                    <p className="ml-auto font-mono text-xs" aria-label={`${details.length} of ${MAX_REPORT_DETAILS_LENGTH} characters used`}>
                      {details.length} / {MAX_REPORT_DETAILS_LENGTH}
                    </p>
                  </div>
                </div>

                <p className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">
                    Akash staff review every report. {publisherName} won&apos;t see who sent it. If you deployed this template, close the deployment and rotate
                    any keys you entered.
                  </span>
                </p>

                {failure && (
                  <Alert variant="destructive">
                    <AlertDescription className="break-words">{failure}</AlertDescription>
                  </Alert>
                )}
              </form>
            </DialogV2Body>
            <DialogV2Footer className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" disabled={isSending} onClick={onClose}>
                Cancel
              </Button>
              <LoadingButton type="submit" form={formId} loading={isSending} disabled={!reason || isSending} className="gap-1.5">
                <Flag className="h-4 w-4" aria-hidden="true" />
                Send report
              </LoadingButton>
            </DialogV2Footer>
          </>
        )}
      </DialogV2Content>
    </DialogV2>
  );
};

const ReasonOption: FC<{ reason: TemplateReportReason; label: string; description: string; isSelected: boolean }> = ({
  reason,
  label,
  description,
  isSelected
}) => {
  const id = `report-reason-${reason}`;

  return (
    <div className={cn("flex items-start gap-3 px-4 py-3 transition-colors", isSelected && "bg-muted/50")}>
      <RadioGroupItem id={id} value={reason} className="mt-0.5 shrink-0" />
      <Label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-[13px] font-normal leading-snug text-muted-foreground">{description}</span>
      </Label>
    </div>
  );
};

function outcomeOf(refusal: ReportRefusal | undefined, reportedVersion: string | undefined): Outcome | undefined {
  switch (refusal?.kind) {
    case "already_reported":
      return {
        tone: "notice",
        title: `You already reported ${reportedVersion ?? "this version"}`,
        message: "Akash staff have your report. You can report the template again when it gets a new version."
      };
    case "not_reportable":
      return {
        tone: "notice",
        title: "This template can't be reported right now",
        message: "It is no longer public, so there is nothing for staff to review."
      };
    case "own_organization":
      return {
        tone: "notice",
        title: "You can't report your own organization's template",
        message: "Members of the organization that published a template change or delete it instead."
      };
    case "removed":
      return { tone: "notice", title: "This template was already removed", message: "There is nothing left to report." };
    case "not_readable":
      return { tone: "notice", title: "You can no longer open this template", message: "It may have been made private since you opened it." };
    default:
      return undefined;
  }
}

function describeFailure(refusal: ReportRefusal | undefined): string {
  if (refusal?.kind === "rate_limited") return refusal.message;
  if (refusal?.kind === "invalid") return "The report wasn't accepted. Remove unusual characters from the details and try again.";
  return "Couldn't send the report. Try again in a moment.";
}
