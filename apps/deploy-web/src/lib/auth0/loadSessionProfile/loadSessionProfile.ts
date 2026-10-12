import type { LoggerService } from "@akashnetwork/logging";
import { isAxiosError } from "axios";
import type { Result } from "ts-results";
import { Err, Ok } from "ts-results";

import type { Session } from "@src/lib/auth0";
import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { SessionService } from "@src/services/session/session.service";
import type { UserSettings } from "@src/types/user";

export interface LoadSessionProfileDependencies {
  sessionService: Pick<SessionService, "getLocalUserDetails">;
  logger: Pick<LoggerService, "warn">;
  errorHandler: Pick<ErrorHandlerService, "reportError">;
}

type SessionProfile = Session["user"] & Partial<UserSettings>;

/** console-api answers 401 to an unexpired token whose user it no longer has, such as an account deleted from another device. */
export async function loadSessionProfile(session: Session, deps: LoadSessionProfileDependencies): Promise<Result<SessionProfile, "session_rejected">> {
  try {
    const userSettings = await deps.sessionService.getLocalUserDetails(session);
    return Ok({ ...session.user, ...userSettings });
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      deps.logger.warn({ event: "AUTH_PROFILE_SESSION_REJECTED_BY_API", userId: session.user.id });
      return Err("session_rejected");
    }

    deps.errorHandler.reportError({ error, tags: { category: "auth0", event: "AUTH_GET_LOCAL_PROFILE_ERROR" } });
    return Ok(session.user);
  }
}
