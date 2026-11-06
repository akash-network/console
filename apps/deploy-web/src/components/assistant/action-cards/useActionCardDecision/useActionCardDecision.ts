import { useEffect, useRef, useState } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";

import { useRecordAssistantActionResultMutation } from "@src/queries/useAssistantQueries";
import type { AssistantActionType } from "@src/types/assistant";

export const DEPENDENCIES = { useRecordAssistantActionResultMutation };

export type ActionCardStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

const MAX_RECORDED_ERROR_LENGTH = 500;

const FALLBACK_ERROR = "Something went wrong. Try again in a moment.";

export interface ActionCardOutcome {
  dseq: string;
  followUrl?: string;
}

export type FollowDeployment = (dseq: string, url?: string) => void;

export interface ActionCardDecisionInput {
  conversationId: string | null;
  proposalId: string;
  actionType: AssistantActionType;
  /** The deployment the action acts on; a card that creates one returns it from its confirm run instead. */
  dseq?: string;
  followDeployment?: FollowDeployment;
}

/** Records every decision and its outcome with the api, which never runs the action itself; recording is best effort and never blocks the card. */
export function useActionCardDecision(
  { conversationId, proposalId, actionType, dseq, followDeployment }: ActionCardDecisionInput,
  d: typeof DEPENDENCIES = DEPENDENCIES
) {
  const { mutateAsync: recordResult } = d.useRecordAssistantActionResultMutation();
  const [status, setStatus] = useState<ActionCardStatus>("pending");
  const [error, setError] = useState<string | null>(null);
  const [deploymentDseq, setDeploymentDseq] = useState<string | null>(null);
  const isShown = useRef(false);

  useEffect(function trackWhetherTheCardIsShown() {
    isShown.current = true;
    return function forgetTheCard() {
      isShown.current = false;
    };
  }, []);

  const record = (result: { decision: "confirmed" | "cancelled"; outcome?: "succeeded" | "failed"; error?: string }) => {
    if (!conversationId) return;
    recordResult({ id: conversationId, data: { proposalId, actionType, ...result } }).catch(() => undefined);
  };

  const confirm = async (run: () => Promise<ActionCardOutcome | void>) => {
    setStatus("running");
    setError(null);
    let outcome: ActionCardOutcome | void;
    try {
      outcome = await run();
    } catch (cause) {
      const message = errorMessageOf(cause);
      setError(message);
      setStatus("failed");
      record({ decision: "confirmed", outcome: "failed", error: message.slice(0, MAX_RECORDED_ERROR_LENGTH) });
      return;
    }
    setStatus("succeeded");
    record({ decision: "confirmed", outcome: "succeeded" });
    const affectedDseq = outcome?.dseq ?? dseq;
    if (!affectedDseq) return;
    setDeploymentDseq(affectedDseq);
    if (isShown.current) followDeployment?.(affectedDseq, outcome?.followUrl);
  };

  const cancel = () => {
    setStatus("cancelled");
    record({ decision: "cancelled" });
  };

  const markOpened = () => {
    setStatus("succeeded");
    record({ decision: "confirmed", outcome: "succeeded" });
  };

  return { status, error, deploymentDseq, confirm, cancel, markOpened };
}

export type ActionCardDecision = ReturnType<typeof useActionCardDecision>;

function errorMessageOf(cause: unknown): string {
  return extractApiErrorMessage(cause) ?? (cause instanceof Error && cause.message ? cause.message : FALLBACK_ERROR);
}
