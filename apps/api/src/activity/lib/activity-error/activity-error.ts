import { type HttpError, isHttpError } from "http-errors";

import type { ActivityMeta } from "@src/activity/model-schemas";

export type ActivityError = NonNullable<ActivityMeta["error"]>;

/** The code in its data wins, as it does in the answer the error handler gives the caller. */
export function errorCodeOf(error: HttpError): string | undefined {
  const { errorCode, data } = error as { errorCode?: string; data?: { errorCode?: string } };
  return data?.errorCode ?? errorCode;
}

/** Only an error meant for the caller is passed on as it is, so nothing internal reaches the feed; anything else reads as the action's own `unexplained` failure. */
export function activityErrorOf(error: unknown, unexplained: ActivityError): ActivityError {
  if (!isHttpError(error) || !error.expose) return unexplained;

  return { code: errorCodeOf(error) ?? unexplained.code, message: error.message };
}
