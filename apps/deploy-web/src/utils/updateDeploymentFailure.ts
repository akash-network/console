import { extractApiErrorMessage, isApiError } from "@akashnetwork/openapi-sdk";

/** The api answers 400 for provider-credential and schema failures too, and only a refusal of the document itself belongs in the editor's inline alert. */
const SDL_REFUSAL_PREFIXES = ["Invalid SDL:", "SDL is not valid YAML", "SDL is too large"];
/** The api wraps trial fair-use gating in the same "Invalid SDL:" 400 as document refusals, yet only adding credits resolves it. */
const TRIAL_GATE_MARK = "not available on free trial";
const ADD_CREDITS_TITLE = "Add credits to continue";

export const UPDATE_FAILURE_MESSAGE = "Something went wrong while updating the deployment. Please try again.";

function isBadRequest(cause: unknown): boolean {
  return isApiError(cause) && cause.status === 400;
}

function isPaymentRequired(cause: unknown): boolean {
  return isApiError(cause) && cause.status === 402;
}

/** Mirrors signAndBroadcast, which keeps client-side refusals out of the failed_tx metric. */
export function isClientRefusal(cause: unknown): boolean {
  return isBadRequest(cause) || isPaymentRequired(cause);
}

export function sdlRefusalOf(cause: unknown): string | null {
  if (!isBadRequest(cause) || trialGateRefusalOf(cause) !== null) return null;

  const message = extractApiErrorMessage(cause);

  return message && SDL_REFUSAL_PREFIXES.some(prefix => message.startsWith(prefix)) ? message : null;
}

function trialGateRefusalOf(cause: unknown): string | null {
  if (!isBadRequest(cause)) return null;

  const message = extractApiErrorMessage(cause);

  return message?.includes(TRIAL_GATE_MARK) ? message.replace(/^Invalid SDL: /, "") : null;
}

export function creditsRefusalOf(cause: unknown): string | null {
  return isPaymentRequired(cause) ? extractApiErrorMessage(cause) ?? "" : trialGateRefusalOf(cause);
}

export function addCreditsContentOf(refusal: string): { title: string; message?: string } {
  const separatorAt = refusal.indexOf(": ");

  if (separatorAt === -1) return { title: ADD_CREDITS_TITLE, message: refusal || undefined };

  return { title: refusal.slice(0, separatorAt), message: refusal.slice(separatorAt + 2) };
}
