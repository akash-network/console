"use client";
import type { FC, KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { extractApiErrorMessage, isApiError } from "@akashnetwork/openapi-sdk";
import { Alert, Button, DialogV2, DialogV2Close, DialogV2Content, DialogV2Description, DialogV2Title, Progress, Snackbar } from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { ArrowLeftIcon, ArrowRightIcon, BanIcon, CalendarClockIcon, SearchIcon, SearchXIcon, SendIcon, XIcon } from "lucide-react";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import type { QuoteRequestData, QuoteRequestSource } from "../gpuQuoteDraft/gpuQuoteCatalog";
import type { ConfigurationHardware, DraftAnswers, GpuQuoteDraft, QuoteStepId, StartingPoint } from "../gpuQuoteDraft/gpuQuoteDraft";
import {
  applyStartingPoint,
  asksUplink,
  configurationStartingPoint,
  createBlankDraft,
  CUSTOM_STARTING_POINT,
  describeMissingAnswers,
  describeNextStep,
  describeReviewLines,
  listMissingAnswers,
  listSteps,
  STARTER_PACKAGES,
  stepToChange,
  toQuoteRequestData
} from "../gpuQuoteDraft/gpuQuoteDraft";
import type { DraftFieldProps } from "../GpuQuoteFields/HardwareFields";
import { GpuField, InterconnectField, StartingPointField, StorageField } from "../GpuQuoteFields/HardwareFields";
import { ContactField, ExtrasField, PriceField, RegionField, SlaField, TimingField } from "../GpuQuoteFields/RequestFields";

export const DEPENDENCIES = { useUser, useSnackbar };

export type ConfigurationPrefill = { hardware: ConfigurationHardware; summary: NonNullable<QuoteRequestData["configuration"]> };

type Props = {
  source: QuoteRequestSource;
  configuration?: ConfigurationPrefill;
  initialAnswers?: DraftAnswers;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

const RESERVE_NOTE = { icon: CalendarClockIcon, text: "Commit to a term for guaranteed GPUs at a lower rate." };

const SOURCE_NOTES: Partial<Record<QuoteRequestSource, { icon: LucideIcon; text: string }>> = {
  no_fit: { icon: SearchXIcon, text: "No provider can host this configuration right now." },
  no_bids: { icon: BanIcon, text: "No provider bid on this configuration." },
  gpu_menu: { icon: SearchIcon, text: "Looking for a GPU that isn't listed?" },
  reserve_capacity: RESERVE_NOTE,
  configure_reserve: RESERVE_NOTE
};

/** The dialog's enter motion slides in from the screen centre, which a full page must not, so its offsets are forced to zero. */
const FULL_PAGE_CLASSES =
  "inset-0 max-h-none max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-background shadow-none sm:rounded-none data-[state=open]:!slide-in-from-left-0 data-[state=open]:!slide-in-from-top-0 data-[state=open]:!zoom-in-100";

type StepFieldProps = DraftFieldProps & { asksUplink: boolean; today: string };

const FIELD_OF_STEP: Partial<Record<QuoteStepId, (props: StepFieldProps) => ReactNode>> = {
  gpu: GpuField,
  interconnect: InterconnectField,
  region: RegionField,
  storage: StorageField,
  sla: SlaField,
  price: PriceField,
  timing: TimingField,
  extras: ExtrasField,
  contact: ContactField
};

const QUESTION_OF_STEP: Record<QuoteStepId, { title: string; hint?: string }> = {
  start: { title: "What are you looking for?", hint: "Pick a common setup, or choose Custom to set every detail." },
  gpu: { title: "Which GPU, and how many?" },
  interconnect: { title: "Do the GPUs need to work together?", hint: "This decides how GPUs connect inside a server and between servers." },
  region: { title: "Where can they run?" },
  storage: { title: "How much storage?" },
  sla: { title: "What uptime do you need?", hint: "Higher guarantees narrow the providers we can work with." },
  price: { title: "What would you like to pay?", hint: "Your target price per GPU-hour." },
  timing: { title: "How long, and from when?" },
  extras: { title: "Anything else?", hint: "Both are optional." },
  contact: { title: "How should we reach you?" },
  review: { title: "Check your request", hint: "Select a line to change it." }
};

/** Enter moves the flow on, except where a control acts on Enter itself; radio cards ignore Enter, so it moves on from them too. */
function continuesOnEnter(event: KeyboardEvent<HTMLElement>): boolean {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) return false;

  const target = event.target as HTMLElement;
  return !!target.closest('[role="radiogroup"]') || !target.closest("button, textarea");
}

function isRequestLimitError(error: unknown): boolean {
  return isApiError(error) && error.status === 429;
}

/** Hitting the request limit is the user's state rather than a fault, so it is shown in the flow instead of being reported. */
const SKIP_REPORTING_REQUEST_LIMIT = { skipErrorReporting: isRequestLimitError };

export const GpuQuoteRequestFlow: FC<Props> = ({ source, configuration, initialAnswers, onClose, dependencies: d = DEPENDENCIES }) => {
  const { api, analyticsService } = useServices();
  const { user } = d.useUser();
  const { enqueueSnackbar } = d.useSnackbar();
  const queryClient = useQueryClient();
  const createHardwareRequest = api.v1.createHardwareRequest.useMutation({ meta: SKIP_REPORTING_REQUEST_LIMIT });
  const configurationPoint = configuration && configurationStartingPoint(configuration.hardware, configuration.summary.summary);
  const configurationKey = configuration && JSON.stringify([configuration.hardware, configuration.summary.summary]);
  const startingPoints = [...(configurationPoint ? [configurationPoint] : []), ...STARTER_PACKAGES, CUSTOM_STARTING_POINT];
  const [draft, setDraft] = useState(() => createInitialDraft({ email: user?.email ?? "", configurationPoint, initialAnswers }));
  const questionId = useId();
  const questionRef = useRef<HTMLHeadingElement>(null);
  const [stepId, setStepId] = useState<QuoteStepId>("start");
  const [showsMissing, setShowsMissing] = useState(false);
  const today = toIsoDate(new Date());
  const answers = startingPoints.find(startingPoint => startingPoint.id === draft.startingPoint)?.answers ?? {};
  const steps = listSteps(draft, answers);
  const stepIndex = Math.max(0, steps.indexOf(stepId));
  const step = steps[stepIndex];
  const isReview = step === "review";
  const blocking = listMissingAnswers(draft, today).filter(answer => answer.step === step);
  const limitMessage = isRequestLimitError(createHardwareRequest.error) ? extractApiErrorMessage(createHardwareRequest.error) : null;

  useEffect(
    function trackFormOpened() {
      analyticsService.track("gpu_request_form_opened", { category: "deployments", source });
    },
    [analyticsService, source]
  );

  useEffect(
    function followConfigurationEdits() {
      if (!configurationKey) return;
      const [hardware, summary] = JSON.parse(configurationKey);
      const editedPoint = configurationStartingPoint(hardware, summary);
      setDraft(current => (current.startingPoint === editedPoint.id ? applyStartingPoint(current, editedPoint) : current));
    },
    [configurationKey]
  );

  useEffect(
    function focusQuestionOfStep() {
      questionRef.current?.focus();
    },
    [step]
  );

  function changeDraft(patch: Partial<GpuQuoteDraft>) {
    setDraft(current => ({ ...current, ...patch }));
  }

  function goTo(nextStep: QuoteStepId) {
    setShowsMissing(false);
    setStepId(nextStep);
  }

  function continueOrSend() {
    if (isReview) {
      sendRequest();
      return;
    }
    if (blocking.length > 0) {
      setShowsMissing(true);
      return;
    }
    if (!draft.startingPoint) changeDraft({ startingPoint: CUSTOM_STARTING_POINT.id });
    goTo(steps[stepIndex + 1]);
  }

  function continueOnEnter(event: KeyboardEvent<HTMLElement>) {
    if (!continuesOnEnter(event) || createHardwareRequest.isPending) return;
    event.preventDefault();
    continueOrSend();
  }

  function sendRequest() {
    createHardwareRequest.mutate(
      { data: toQuoteRequestData(draft, { source, configuration: configuration?.summary }) },
      {
        onSuccess: function confirmSentAndClose(response) {
          analyticsService.track("gpu_request_sent", { category: "deployments", source, lane: response.data.lane, hardwareRequestId: response.data.id });
          void queryClient.invalidateQueries({ queryKey: api.v1.listHardwareRequests.getKey() });
          enqueueSnackbar(<Snackbar title="Request sent" subTitle={describeNextStep(response.data, new Date())} iconVariant="success" />, {
            variant: "success"
          });
          onClose();
        },
        onError: function reportSendFailure(error) {
          if (isRequestLimitError(error)) return;
          enqueueSnackbar(<Snackbar title="Couldn't send your request" subTitle="Please try again, or ask us on Discord." iconVariant="error" />, {
            variant: "error"
          });
        }
      }
    );
  }

  const question = QUESTION_OF_STEP[step];
  const StepField = FIELD_OF_STEP[step];
  const sourceNote = stepIndex === 0 ? SOURCE_NOTES[source] : undefined;

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen ? onClose() : undefined)}>
      <DialogV2Content
        hideCloseButton
        onOpenAutoFocus={event => {
          event.preventDefault();
          questionRef.current?.focus();
        }}
        onKeyDown={continueOnEnter}
        className={FULL_PAGE_CLASSES}
      >
        <header className="relative flex h-14 shrink-0 items-center gap-3 border-b pl-5 pr-3">
          <DialogV2Title className="text-sm font-semibold leading-5 tracking-normal">Request GPUs</DialogV2Title>
          <span aria-hidden="true" className="font-mono text-xs text-muted-foreground">
            {stepIndex + 1} / {steps.length}
          </span>
          <DialogV2Description className="sr-only">{`Step ${stepIndex + 1} of ${steps.length}`}</DialogV2Description>
          <DialogV2Close asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Close" className="ml-auto h-8 w-8">
              <XIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DialogV2Close>
          <Progress
            value={((stepIndex + 1) / steps.length) * 100}
            aria-label="Request progress"
            className="absolute -bottom-px left-0 h-0.5 rounded-none bg-transparent [&>div]:bg-foreground [&>div]:duration-300 motion-reduce:[&>div]:transition-none"
          />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <section
            key={step}
            aria-labelledby={questionId}
            className="mx-auto flex max-w-[640px] flex-col gap-6 px-4 pb-8 pt-7 duration-300 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none sm:px-6 sm:pb-10 sm:pt-[clamp(2rem,7vh,4.5rem)]"
          >
            <div className="flex flex-col gap-2">
              {sourceNote && (
                <p className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                  <sourceNote.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {sourceNote.text}
                </p>
              )}
              <h3
                id={questionId}
                ref={questionRef}
                tabIndex={-1}
                className="text-balance text-[22px] font-bold leading-tight tracking-[-0.015em] focus:outline-none sm:text-[28px]"
              >
                {question.title}
              </h3>
              {question.hint && <p className="text-sm text-muted-foreground">{question.hint}</p>}
            </div>
            {step === "start" && (
              <StartingPointField
                startingPoints={startingPoints}
                value={draft.startingPoint}
                onPick={startingPoint => setDraft(current => applyStartingPoint(current, startingPoint))}
              />
            )}
            {StepField && <StepField draft={draft} onChange={changeDraft} asksUplink={asksUplink(answers)} today={today} />}
            {isReview && (
              <ul className="divide-y rounded-lg border">
                {describeReviewLines(draft).map(line => (
                  <li key={line.label}>
                    <button
                      type="button"
                      onClick={() => goTo(stepToChange(steps, line.step))}
                      className="grid w-full grid-cols-[7rem_minmax(0,1fr)] gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/60"
                    >
                      <span className="font-mono text-xs uppercase leading-5 tracking-wider text-muted-foreground">{line.label}</span>
                      <span className={line.value ? "font-medium" : "text-warning"}>{line.value ?? "Needs an answer"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showsMissing && blocking.length > 0 && (
              <p role="alert" className="text-sm font-medium text-warning">
                {describeMissingAnswers(blocking, "continue")}
              </p>
            )}
            {limitMessage && <Alert variant="destructive">{limitMessage}</Alert>}
          </section>
        </div>
        <footer className="shrink-0 border-t px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex max-w-[640px] items-center gap-2.5">
            <Button type="button" variant="ghost" disabled={stepIndex === 0} onClick={() => goTo(steps[stepIndex - 1])} className="gap-2">
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
            <span aria-hidden="true" className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
              {!isReview && (
                <span className="hidden sm:inline">
                  Press <span className="font-mono">Enter ↵</span>
                </span>
              )}
            </span>
            <Button type="button" disabled={createHardwareRequest.isPending} onClick={continueOrSend} className="gap-2">
              {isReview ? "Send request" : "Continue"}
              {isReview ? <SendIcon className="h-4 w-4" aria-hidden="true" /> : <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </div>
        </footer>
      </DialogV2Content>
    </DialogV2>
  );
};

function createInitialDraft({
  email,
  configurationPoint,
  initialAnswers
}: {
  email: string;
  configurationPoint?: StartingPoint;
  initialAnswers?: DraftAnswers;
}): GpuQuoteDraft {
  const blank = createBlankDraft(email);
  const prefilled = configurationPoint ? applyStartingPoint(blank, configurationPoint) : blank;
  return initialAnswers ? applyStartingPoint(prefilled, { ...CUSTOM_STARTING_POINT, answers: initialAnswers }) : prefilled;
}

function toIsoDate(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
