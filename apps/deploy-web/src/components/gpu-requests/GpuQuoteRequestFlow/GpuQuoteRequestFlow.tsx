"use client";
import type { FC, ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import { extractApiErrorMessage, isApiError } from "@akashnetwork/openapi-sdk";
import {
  Alert,
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Snackbar
} from "@akashnetwork/ui/components";
import { ArrowLeftIcon, ArrowRightIcon, SendIcon } from "lucide-react";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import type { QuoteRequestData, QuoteRequestSource } from "../gpuQuoteDraft/gpuQuoteCatalog";
import type { ConfigurationHardware, DraftAnswers, GpuQuoteDraft, QuoteStepId, RequestLane, StartingPoint } from "../gpuQuoteDraft/gpuQuoteDraft";
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

const SOURCE_NOTES: Partial<Record<QuoteRequestSource, string>> = {
  no_fit: "No provider can host this configuration right now.",
  no_bids: "No provider bid on this configuration.",
  gpu_menu: "Looking for a GPU that isn't listed?",
  reserve_capacity: "Reserve GPUs for a term.",
  configure_reserve: "Reserve GPUs for a term."
};

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
  start: { title: "What are you looking for?", hint: "Pick a common setup, or Custom to choose every detail." },
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

function isRequestLimitError(error: unknown): boolean {
  return isApiError(error) && error.status === 429;
}

/** Hitting the request limit is the user's state rather than a fault, so it is shown in the flow instead of being reported. */
const SKIP_REPORTING_REQUEST_LIMIT = { skipErrorReporting: isRequestLimitError };

/** The API only adds the lane later, so a response without one reads as the automated lane. */
function laneOf(data: object): RequestLane | undefined {
  return "lane" in data && (data.lane === "sales" || data.lane === "automated") ? data.lane : undefined;
}

export const GpuQuoteRequestFlow: FC<Props> = ({ source, configuration, initialAnswers, onClose, dependencies: d = DEPENDENCIES }) => {
  const { api } = useServices();
  const { user } = d.useUser();
  const { enqueueSnackbar } = d.useSnackbar();
  const createHardwareRequest = api.v1.createHardwareRequest.useMutation({ meta: SKIP_REPORTING_REQUEST_LIMIT });
  const configurationPoint = configuration && configurationStartingPoint(configuration.hardware);
  const configurationKey = configuration && JSON.stringify(configuration.hardware);
  const startingPoints = [...(configurationPoint ? [configurationPoint] : []), ...STARTER_PACKAGES, CUSTOM_STARTING_POINT];
  const [draft, setDraft] = useState(() => createInitialDraft({ email: user?.email ?? "", configurationPoint, initialAnswers }));
  const questionId = useId();
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
    function followConfigurationEdits() {
      if (!configurationKey) return;
      const editedPoint = configurationStartingPoint(JSON.parse(configurationKey));
      setDraft(current => (current.startingPoint === editedPoint.id ? applyStartingPoint(current, editedPoint) : current));
    },
    [configurationKey]
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

  function sendRequest() {
    createHardwareRequest.mutate(
      { data: toQuoteRequestData(draft, { source, configuration: configuration?.summary }) },
      {
        onSuccess: function confirmSentAndClose(response) {
          enqueueSnackbar(<Snackbar title="Request sent" subTitle={describeNextStep(laneOf(response.data))} iconVariant="success" />, { variant: "success" });
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

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen ? onClose() : undefined)}>
      <DialogV2Content className="max-w-2xl">
        <DialogV2Header>
          <DialogV2Title>Request GPUs</DialogV2Title>
          <DialogV2Description>{`Step ${stepIndex + 1} of ${steps.length}`}</DialogV2Description>
        </DialogV2Header>
        <DialogV2Body>
          <section aria-labelledby={questionId} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              {stepIndex === 0 && SOURCE_NOTES[source] && <p className="text-sm text-muted-foreground">{SOURCE_NOTES[source]}</p>}
              <h3 id={questionId} className="text-xl font-semibold tracking-tight">
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
        </DialogV2Body>
        <DialogV2Footer className="sm:justify-between">
          <Button type="button" variant="ghost" disabled={stepIndex === 0} onClick={() => goTo(steps[stepIndex - 1])} className="gap-2">
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Back
          </Button>
          <Button type="button" disabled={createHardwareRequest.isPending} onClick={continueOrSend} className="gap-2">
            {isReview ? "Send request" : "Continue"}
            {isReview ? <SendIcon className="h-4 w-4" aria-hidden="true" /> : <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </DialogV2Footer>
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
