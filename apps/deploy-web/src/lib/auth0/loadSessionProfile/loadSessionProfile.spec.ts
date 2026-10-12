import type { LoggerService } from "@akashnetwork/logging";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Session } from "@src/lib/auth0";
import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { SessionService } from "@src/services/session/session.service";
import type { UserSettings } from "@src/types/user";
import { loadSessionProfile } from "./loadSessionProfile";

describe(loadSessionProfile.name, () => {
  it("merges the user's settings into the cached profile", async () => {
    const { session, sessionService, errorHandler, deps } = setup();
    sessionService.getLocalUserDetails.mockResolvedValue(mock<UserSettings>({ username: "fresh-name" }));

    const result = await loadSessionProfile(session, deps);

    expect(result.ok).toBe(true);
    expect(result.val).toMatchObject({ id: "user-1", email: "user@example.com", username: "fresh-name" });
    expect(errorHandler.reportError).not.toHaveBeenCalled();
  });

  it("rejects the session and warns with the user id when console-api answers 401", async () => {
    const { session, sessionService, logger, errorHandler, deps } = setup();
    sessionService.getLocalUserDetails.mockRejectedValue(createAxiosError(401));

    const result = await loadSessionProfile(session, deps);

    expect(result.err).toBe(true);
    expect(result.val).toBe("session_rejected");
    expect(logger.warn).toHaveBeenCalledWith({ event: "AUTH_PROFILE_SESSION_REJECTED_BY_API", userId: "user-1" });
    expect(errorHandler.reportError).not.toHaveBeenCalled();
  });

  it("reports the error and falls back to the cached profile when console-api answers another status", async () => {
    const { session, sessionService, logger, errorHandler, deps } = setup();
    const error = createAxiosError(500);
    sessionService.getLocalUserDetails.mockRejectedValue(error);

    const result = await loadSessionProfile(session, deps);

    expect(result.ok).toBe(true);
    expect(result.val).toEqual(session.user);
    expect(errorHandler.reportError).toHaveBeenCalledWith({ error, tags: { category: "auth0", event: "AUTH_GET_LOCAL_PROFILE_ERROR" } });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("reports the error and falls back to the cached profile when the request got no answer", async () => {
    const { session, sessionService, errorHandler, deps } = setup();
    const error = new AxiosError("Network Error");
    sessionService.getLocalUserDetails.mockRejectedValue(error);

    const result = await loadSessionProfile(session, deps);

    expect(result.ok).toBe(true);
    expect(errorHandler.reportError).toHaveBeenCalledWith(expect.objectContaining({ error }));
  });

  it("reports a non-axios error carrying a 401 response instead of rejecting the session", async () => {
    const { session, sessionService, errorHandler, deps } = setup();
    const error = { response: { status: 401 } };
    sessionService.getLocalUserDetails.mockRejectedValue(error);

    const result = await loadSessionProfile(session, deps);

    expect(result.ok).toBe(true);
    expect(errorHandler.reportError).toHaveBeenCalledWith(expect.objectContaining({ error }));
  });

  function setup() {
    const session = mock<Session>({ user: { id: "user-1", email: "user@example.com" } });
    const sessionService = mock<Pick<SessionService, "getLocalUserDetails">>();
    const logger = mock<Pick<LoggerService, "warn">>();
    const errorHandler = mock<Pick<ErrorHandlerService, "reportError">>();

    return { session, sessionService, logger, errorHandler, deps: { sessionService, logger, errorHandler } };
  }

  function createAxiosError(status: number) {
    return new AxiosError("Request failed", String(status), undefined, undefined, {
      status,
      statusText: "",
      data: {},
      headers: {},
      config: { headers: new AxiosHeaders() }
    });
  }
});
