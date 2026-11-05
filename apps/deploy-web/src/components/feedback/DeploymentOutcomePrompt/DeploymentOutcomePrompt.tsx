"use client";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { extractApiErrorCode } from "@akashnetwork/openapi-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import { usePathname } from "next/navigation";
import { useSnackbar } from "notistack";

import { useDeploymentOutcomes } from "@src/hooks/useDeploymentOutcomes/useDeploymentOutcomes";
import { useFlag } from "@src/hooks/useFlag";
import { useCreateFeedbackMutation, useFeedbackOutcomePromptQuery } from "@src/queries/useFeedbackQueries";
import type { KnownDeploymentOutcome } from "@src/store/deploymentOutcomeStore";
import type { DeploymentOutcomeAnswer } from "../DeploymentOutcomeCard/DeploymentOutcomeCard";
import { DeploymentOutcomeCard } from "../DeploymentOutcomeCard/DeploymentOutcomeCard";

export const DEPENDENCIES = {
  useFlag,
  useDeploymentOutcomes,
  useFeedbackOutcomePromptQuery,
  useCreateFeedbackMutation,
  useSnackbar,
  usePathname,
  DeploymentOutcomeCard
};

export const FEEDBACK_ALREADY_ANSWERED_ERROR_CODE = "feedback_already_answered";
export const FEEDBACK_LIMIT_ERROR_CODE = "feedback_limit";

type Props = {
  dseq: string;
  outcome: KnownDeploymentOutcome | undefined;
  deploymentName?: string;
  dependencies?: typeof DEPENDENCIES;
};

/** Asks once per tab session, and only after the api confirms the deployment was never answered and no cooldown applies. */
export const DeploymentOutcomePrompt: FC<Props> = ({ dseq, outcome, deploymentName, dependencies: d = DEPENDENCIES }) => {
  const isEnabled = d.useFlag("user_feedback_loop");
  const { outcomes, markPrompted } = d.useDeploymentOutcomes();
  const [shownOutcome, setShownOutcome] = useState<KnownDeploymentOutcome>();
  const [isClosed, setIsClosed] = useState(false);
  const isAskable = isEnabled && !!outcome && !outcomes[dseq]?.isPrompted && !shownOutcome;
  const { data: prompt } = d.useFeedbackOutcomePromptQuery(dseq, { enabled: isAskable });
  const { mutate: createFeedback, isPending: isSending } = d.useCreateFeedbackMutation();
  const { enqueueSnackbar } = d.useSnackbar();
  const page = d.usePathname() ?? undefined;

  useEffect(
    function showWhenEligible() {
      if (!isAskable || !prompt?.eligible || prompt.dseq !== dseq) return;
      markPrompted(dseq);
      setShownOutcome(outcome);
    },
    [isAskable, prompt, dseq, outcome, markPrompted]
  );

  if (!isEnabled || !shownOutcome || isClosed) return null;

  const feedbackBase = { kind: "deployment_outcome" as const, dseq, outcome: shownOutcome.outcome, failureReason: shownOutcome.failureReason, page };

  const dismiss = () => {
    setIsClosed(true);
    createFeedback({ data: { ...feedbackBase, dismissed: true } });
  };

  const reportRefusal = (error: unknown) => {
    const code = extractApiErrorCode(error);
    if (code === FEEDBACK_ALREADY_ANSWERED_ERROR_CODE) {
      setIsClosed(true);
    } else if (code === FEEDBACK_LIMIT_ERROR_CODE) {
      enqueueSnackbar(<Snackbar title="You've sent a lot of feedback today" subTitle="Try again tomorrow." iconVariant="warning" />, { variant: "warning" });
    } else {
      enqueueSnackbar(<Snackbar title="Couldn't send your feedback" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
    }
  };

  const send = (answer: DeploymentOutcomeAnswer) => {
    createFeedback(
      { data: { ...feedbackBase, dismissed: false, ...answer } },
      {
        onSuccess: () => {
          setIsClosed(true);
          enqueueSnackbar(<Snackbar title="Thanks for the feedback" iconVariant="success" />, { variant: "success" });
        },
        onError: reportRefusal
      }
    );
  };

  return <d.DeploymentOutcomeCard outcome={shownOutcome.outcome} deploymentName={deploymentName} isSending={isSending} onSend={send} onDismiss={dismiss} />;
};
