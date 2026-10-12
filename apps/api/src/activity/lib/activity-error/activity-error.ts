import { isHttpError } from "http-errors";

export type ActivityError = { code: string; message: string };

/** Only an error meant for the caller lends the activity its own message, so nothing internal reaches the feed. */
export function activityErrorOf(error: unknown, unexplained: ActivityError): ActivityError {
  if (!isHttpError(error) || !error.expose) return unexplained;

  const { errorCode, data } = error as { errorCode?: string; data?: { errorCode?: string } };
  return { code: data?.errorCode ?? errorCode ?? unexplained.code, message: error.message };
}
