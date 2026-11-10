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
import { unitOfGpu } from "../gpuQuoteDraft/gpuQuoteCatalog";
import type { ConfigurationHardware, DraftAnswers, GpuQuoteDraft, MissingAnswer, QuoteStepId, StartingPoint } from "../gpuQuoteDraft/gpuQuoteDraft";
import {
  applyStartingPoint,
  configurationStartingPoint,
  createBlankDraft,
  CUSTOM_STARTING_POINT,
  describeMissingAnswers,
  describeNextStep,
  formatDate,
  listMissingAnswers,
  listSteps,
  STARTER_PACKAGES,
  stepToChange,
  toIsoDate,
  toQuoteRequestData
} from "../gpuQuoteDraft/gpuQuoteDraft";
import { describeReceiptSections } from "../gpuQuoteDraft/gpuQuoteReceipt";
import type { DraftFieldProps } from "../GpuQuoteFields/HardwareFields";
import { GpuField, InterconnectField, StartingPointField, StorageField } from "../GpuQuoteFields/HardwareFields";
import { ContactField, RegionField, SlaField, TimingField } from "../GpuQuoteFields/RequestFields";
import { GpuQuoteReceipt } from "../GpuQuoteReceipt/GpuQuoteReceipt";
import { GpuRackBuild } from "../GpuRackBuild/GpuRackBuild";
import { describeRackBuild } from "../GpuRackBuild/rackBuild";

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

/** One column below 860px; from there the question sits beside the server room, which widens at 1100px. */
const COLUMNS_CLASSES =
  "mx-auto w-full max-w-[640px] px-4 sm:px-6 min-[860px]:max-w-[980px] min-[860px]:grid-cols-[minmax(0,1fr)_300px] min-[860px]:gap-x-8 min-[1100px]:max-w-[1044px] min-[1100px]:grid-cols-[minmax(0,1fr)_340px] min-[1100px]:gap-x-14";

const PICK_A_SETUP: MissingAnswer = { step: "start", label: "a setup" };

type StepFieldProps = DraftFieldProps & { today: string; asksEmail: boolean };

const FIELD_OF_STEP: Partial<Record<QuoteStepId, (props: StepFieldProps) => ReactNode>> = {
  gpu: GpuField,
  interconnect: InterconnectField,
  region: RegionField,
  storage: StorageField,
  sla: SlaField,
  timing: TimingField,
  contact: ContactField
};

type Question = { title: string; hint?: string };

function questionOfStep(step: QuoteStepId, draft: GpuQuoteDraft, asksEmail: boolean): Question {
  const unit = unitOfGpu(draft.gpuModel).name;

  switch (step) {
    case "start":
      return { title: "What are you looking for?", hint: "Pick a common setup, or choose Custom to set every detail." };
    case "gpu":
      return { title: `Which GPU, and how many ${unit}s?` };
    case "interconnect":
      return { title: "Which network between servers?", hint: "Your GPUs are linked across servers over this network." };
    case "region":
      return { title: "Where can they run?" };
    case "storage":
      return { title: `How much storage per ${unit}?` };
    case "sla":
      return {
        title: "What uptime do you need?",
        hint: "The SLA sets how much downtime you can accept each month. Higher guarantees narrow the providers we can work with."
      };
    case "timing":
      return { title: "How long, and from when?" };
    case "contact":
      return {
        title: "How should we reach you?",
        hint: asksEmail ? "Add the email we should reply to, and a phone number if you'd also like a call." : `We'll email you at ${draft.email}. Add a phone number if you'd also like a call.`
      };
    case "review":
      return { title: "Check your request", hint: "Click any section to change it." };
  }
}

/** Enter moves the flow on, except where a control acts on Enter itself; radio cards ignore Enter, so it moves on from them too. */
function continuesOnEnter(event: KeyboardEvent<HTMLElement>): boolean {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) return false;

  const target = event.target as HTMLElement;
  return !!target.closest('[role="radiogroup"]') || !target.closest('button, textarea, [role="combobox"], [role="listbox"]');
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
  const [asksEmail] = useState(() => !user?.email);
  const questionId = useId();
  const questionRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stepId, setStepId] = useState<QuoteStepId>("start");
  const [reachedSteps, setReachedSteps] = useState<ReadonlySet<QuoteStepId>>(() => new Set(["start"]));
  const [showsMissing, setShowsMissing] = useState(false);
  const today = toIsoDate(new Date());
  const startingPoint = startingPoints.find(point => point.id === draft.startingPoint);
  const steps = listSteps(startingPoint?.answers ?? {});
  const stepIndex = Math.max(0, steps.indexOf(stepId));
  const step = steps[stepIndex];
  const isReview = step === "review";
  const hasReviewed = reachedSteps.has("review");
  const nextStep = hasReviewed ? steps.slice(stepIndex + 1).find(later => !reachedSteps.has(later)) ?? "review" : steps[stepIndex + 1];
  const missing = listMissingAnswers(draft, today);
  const blocking = step === "start" && !draft.startingPoint ? [PICK_A_SETUP] : missing.filter(answer => answer.step === step);
  const limitMessage = isRequestLimitError(createHardwareRequest.error) ? extractApiErrorMessage(createHardwareRequest.error) : null;
  const rackBuild = describeRackBuild({ steps, draft, setupName: startingPoint?.name, reachedSteps, currentStep: step });

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
    function showQuestionOfStep() {
      scrollRef.current?.scrollTo?.({ top: 0 });
      questionRef.current?.focus();
    },
    [step]
  );

  function changeDraft(patch: Partial<GpuQuoteDraft>) {
    setDraft(current => ({ ...current, ...patch }));
  }

  function goTo(targetStep: QuoteStepId) {
    setShowsMissing(false);
    setStepId(targetStep);
    setReachedSteps(current => (current.has(targetStep) ? current : new Set([...current, targetStep])));
  }

  function continueOrSend() {
    if (isReview) {
      sendOrShowMissing();
      return;
    }
    if (blocking.length > 0) {
      setShowsMissing(true);
      return;
    }
    goTo(nextStep);
  }

  function sendOrShowMissing() {
    if (missing.length === 0) {
      sendRequest();
      return;
    }
    goTo(stepToChange(steps, missing[0].step));
    setShowsMissing(true);
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

  const question = questionOfStep(step, draft, asksEmail);
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
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <div className={`${COLUMNS_CLASSES} grid items-start pb-8 pt-7 sm:pb-10 sm:pt-[clamp(2rem,7vh,4.5rem)]`}>
            <section
              key={step}
              aria-labelledby={questionId}
              className="flex min-w-0 flex-col gap-6 duration-300 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
            >
              <div className="flex flex-col gap-2">
                {sourceNote && (
                  <p className="inline-flex items-center gap-2 text-[12.5px] text-muted-foreground">
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
                {question.hint && <p className="text-pretty text-sm text-muted-foreground">{question.hint}</p>}
              </div>
              {step === "start" && (
                <StartingPointField
                  startingPoints={startingPoints}
                  value={draft.startingPoint}
                  onPick={pickedPoint => setDraft(current => applyStartingPoint(current, pickedPoint))}
                />
              )}
              {StepField && <StepField draft={draft} onChange={changeDraft} today={today} asksEmail={asksEmail} />}
              {isReview && (
                <GpuQuoteReceipt
                  sections={describeReceiptSections(steps, draft, startingPoint)}
                  date={formatDate(today, { month: "short", day: "numeric", year: "numeric" })}
                  onChangeStep={goTo}
                />
              )}
              {showsMissing && blocking.length > 0 && (
                <p role="alert" className="text-sm font-medium text-warning">
                  {step === "start" ? "Pick a setup to continue." : describeMissingAnswers(blocking, "continue")}
                </p>
              )}
              {limitMessage && <Alert variant="destructive">{limitMessage}</Alert>}
            </section>
            <aside aria-label="Your server room" className="sticky top-6 hidden min-w-0 min-[860px]:block">
              <GpuRackBuild build={rackBuild} onChangeStep={goTo} />
            </aside>
          </div>
        </div>
        <footer className="shrink-0 border-t pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          <div className={`${COLUMNS_CLASSES} flex items-center gap-2.5`}>
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
              {isReview ? "Send request" : hasReviewed && nextStep === "review" ? "Back to review" : "Continue"}
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
