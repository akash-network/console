import type { LoggerService } from "@akashnetwork/logging";
import type { NextApiRequest, NextApiResponse } from "next";
import { Err, Ok } from "ts-results";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Session } from "@src/lib/auth0";
import type { RefreshedTokens, SessionService } from "@src/services/session/session.service";
import { createGetSessionWithRefresh } from "./getSessionWithRefresh";

const NOW_SECONDS = Math.floor(Date.now() / 1_000);

describe(createGetSessionWithRefresh.name, () => {
  it("returns the empty result when there is no session", async () => {
    const { getSessionWithRefresh, sessionService, req, res } = setup({ session: null });

    const result = await getSessionWithRefresh(req, res);

    expect(result).toBeNull();
    expect(sessionService.refreshAccessToken).not.toHaveBeenCalled();
  });

  it("returns the session untouched when the access token is not expired", async () => {
    const session = createSession({ accessTokenExpiresAt: NOW_SECONDS + 3_600 });
    const { getSessionWithRefresh, sessionService, setSession, req, res } = setup({ session });

    const result = await getSessionWithRefresh(req, res);

    expect(result).toBe(session);
    expect(result?.accessToken).toBe("expired-access-token");
    expect(sessionService.refreshAccessToken).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });

  it("returns an expired session untouched when it has no refresh token", async () => {
    const session = createSession({ accessTokenExpiresAt: NOW_SECONDS - 60, refreshToken: undefined });
    const { getSessionWithRefresh, sessionService, req, res } = setup({ session });

    const result = await getSessionWithRefresh(req, res);

    expect(result).toBe(session);
    expect(sessionService.refreshAccessToken).not.toHaveBeenCalled();
  });

  it("refreshes, persists, and returns the session when the token is expired", async () => {
    const session = createSession({ accessTokenExpiresAt: NOW_SECONDS - 60 });
    const { getSessionWithRefresh, sessionService, setSession, req, res } = setup({ session });
    sessionService.refreshAccessToken.mockResolvedValue(Ok(createRefreshedTokens()));

    const result = await getSessionWithRefresh(req, res);

    expect(sessionService.refreshAccessToken).toHaveBeenCalledWith("refresh-token");
    expect(setSession).toHaveBeenCalledWith(req, res, session);
    expect(result?.accessToken).toBe("new-access-token");
    expect(result?.refreshToken).toBe("rotated-refresh-token");
    expect(result?.accessTokenExpiresAt).toBe(NOW_SECONDS + 3_600);
    expect(result?.user).toEqual(session.user);
  });

  it("treats a missing accessTokenExpiresAt as expired", async () => {
    const session = createSession({ accessTokenExpiresAt: undefined });
    const { getSessionWithRefresh, sessionService, req, res } = setup({ session });
    sessionService.refreshAccessToken.mockResolvedValue(Ok(createRefreshedTokens()));

    await getSessionWithRefresh(req, res);

    expect(sessionService.refreshAccessToken).toHaveBeenCalledWith("refresh-token");
  });

  it("clears the session cookies and returns null when the refresh fails", async () => {
    const session = createSession({ accessTokenExpiresAt: NOW_SECONDS - 60 });
    const { getSessionWithRefresh, sessionService, setSession, req, res } = setup({ session });
    sessionService.refreshAccessToken.mockResolvedValue(Err({ code: "invalid_grant", message: "revoked", cause: {} }));

    const result = await getSessionWithRefresh(req, res);

    expect(result).toBeNull();
    expect(setSession).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.arrayContaining([expect.stringContaining("appSession=;")]));
  });

  it("keeps the existing idToken and scope when the refresh response omits them", async () => {
    const session = createSession({ accessTokenExpiresAt: NOW_SECONDS - 60 });
    session.idToken = "existing-id-token";
    session.accessTokenScope = "openid profile email offline_access";
    const { getSessionWithRefresh, sessionService, req, res } = setup({ session });
    sessionService.refreshAccessToken.mockResolvedValue(Ok({ ...createRefreshedTokens(), idToken: undefined, accessTokenScope: undefined }));

    const result = await getSessionWithRefresh(req, res);

    expect(result?.accessToken).toBe("new-access-token");
    expect(result?.idToken).toBe("existing-id-token");
    expect(result?.accessTokenScope).toBe("openid profile email offline_access");
  });

  it("still returns the refreshed session when persisting the cookie fails", async () => {
    const session = createSession({ accessTokenExpiresAt: NOW_SECONDS - 60 });
    const { getSessionWithRefresh, sessionService, setSession, logger, req, res } = setup({ session });
    sessionService.refreshAccessToken.mockResolvedValue(Ok(createRefreshedTokens()));
    setSession.mockRejectedValue(new Error("session cache not initialized"));

    const result = await getSessionWithRefresh(req, res);

    expect(result?.accessToken).toBe("new-access-token");
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ACCESS_TOKEN_REFRESH_PERSIST_FAILED" }));
  });

  it("shares one refresh call between concurrent requests carrying the same refresh token", async () => {
    const { getSessionWithRefresh, sessionService, getSession, req, res } = setup({ session: null });
    getSession.mockImplementation(async () => createSession({ accessTokenExpiresAt: NOW_SECONDS - 60 }));
    let resolveRefresh!: (value: Awaited<ReturnType<SessionService["refreshAccessToken"]>>) => void;
    sessionService.refreshAccessToken.mockReturnValue(new Promise(resolve => (resolveRefresh = resolve)));

    const first = getSessionWithRefresh(req, res);
    const second = getSessionWithRefresh(req, res);
    resolveRefresh(Ok(createRefreshedTokens()));
    const results = await Promise.all([first, second]);

    expect(sessionService.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(results[0]?.accessToken).toBe("new-access-token");
    expect(results[1]?.accessToken).toBe("new-access-token");
  });

  it("performs a fresh refresh once the previous one has settled", async () => {
    const { getSessionWithRefresh, sessionService, getSession, req, res } = setup({ session: null });
    getSession.mockImplementation(async () => createSession({ accessTokenExpiresAt: NOW_SECONDS - 60 }));
    sessionService.refreshAccessToken.mockResolvedValue(Ok(createRefreshedTokens()));

    await getSessionWithRefresh(req, res);
    await getSessionWithRefresh(req, res);

    expect(sessionService.refreshAccessToken).toHaveBeenCalledTimes(2);
  });

  function setup(input: { session: Session | null }) {
    const getSession = vi.fn(async () => input.session);
    const setSession = vi.fn(async () => undefined);
    const sessionService = mock<Pick<SessionService, "refreshAccessToken">>();
    const logger = mock<Pick<LoggerService, "info" | "warn">>();
    const req = mock<NextApiRequest>({ cookies: { appSession: "encrypted" } });
    const res = mock<NextApiResponse>({ getHeader: vi.fn(() => undefined) });
    const getSessionWithRefresh = createGetSessionWithRefresh({ getSession, setSession, sessionService, logger });

    return { getSessionWithRefresh, getSession, setSession, sessionService, logger, req, res };
  }
});

function createSession(input: { accessTokenExpiresAt: number | undefined; refreshToken?: string | undefined }) {
  return mock<Session>({
    accessToken: "expired-access-token",
    accessTokenExpiresAt: input.accessTokenExpiresAt,
    refreshToken: "refreshToken" in input ? input.refreshToken : "refresh-token",
    user: { id: "user-1", email: "user@example.com" }
  });
}

function createRefreshedTokens(): RefreshedTokens {
  return {
    accessToken: "new-access-token",
    accessTokenScope: "openid profile email offline_access",
    accessTokenExpiresAt: NOW_SECONDS + 3_600,
    refreshToken: "rotated-refresh-token",
    idToken: "new-id-token"
  };
}
