import { isHttpError } from "http-errors";

import type { ActivityMeta } from "@src/activity/model-schemas";

export type ActivityError = NonNullable<ActivityMeta["error"]>;

/** Only an error meant for the caller is passed on as it is, so nothing internal reaches the feed; anything else reads as the action's own `unexplained` failure. */
export function activityErrorOf(error: unknown, unexplained: ActivityError): ActivityError {
  if (!isHttpError(error) || !error.expose) return unexplained;

  const { errorCode, data } = error as { errorCode?: string; data?: { errorCode?: string } };
  return { code: data?.errorCode ?? errorCode ?? unexplained.code, message: error.message };
}
