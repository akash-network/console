import createError from "http-errors";

export const ASSISTANT_ERROR_CODES = {
  unavailable: "assistant_unavailable",
  consentRequired: "assistant_consent_required",
  consentOutdated: "assistant_consent_outdated",
  rateLimited: "assistant_rate_limited",
  dailyLimit: "assistant_daily_limit",
  conversationEnded: "assistant_conversation_ended",
  noPendingToolRequest: "assistant_no_pending_tool_request",
  toolResultsMismatch: "assistant_tool_results_mismatch",
  proposalNotFound: "assistant_proposal_not_found"
} as const;

export function assistantDailyLimitReached() {
  return createError(429, "You reached today's assistant limit. Try again tomorrow, or ask on Discord.", { errorCode: ASSISTANT_ERROR_CODES.dailyLimit });
}

export function assistantUnavailable() {
  return createError(503, "The assistant is unavailable right now. Ask on Discord for live help.", { errorCode: ASSISTANT_ERROR_CODES.unavailable });
}
