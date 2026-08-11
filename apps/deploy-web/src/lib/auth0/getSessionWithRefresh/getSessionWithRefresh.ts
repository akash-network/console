import type { LoggerService } from "@akashnetwork/logging";
import type { IncomingMessage, ServerResponse } from "http";
import type { NextApiRequest, NextApiResponse } from "next";

import type { Session } from "@src/lib/auth0";
import { clearSessionCookies } from "@src/lib/auth0/clearSessionCookies/clearSessionCookies";
import type { setSession } from "@src/lib/auth0/setSession/setSession";
import type { SessionService } from "@src/services/session/session.service";

export type SessionRequest = (IncomingMessage & { cookies: NextApiRequest["cookies"] }) | NextApiRequest;
export type SessionResponse = ServerResponse | NextApiResponse;
export type GetSession = (req: SessionRequest, res: SessionResponse) => Promise<Session | null | undefined>;

export interface GetSessionWithRefreshDependencies {
  getSession: GetSession;
  setSession: typeof setSession;
  sessionService: Pick<SessionService, "refreshAccessToken">;
  logger: Pick<LoggerService, "info" | "warn">;
}

/**
 * Wraps `getSession` so an expired access token is transparently renewed with the session's refresh
 * token instead of being treated as "logged out" (DEPLOY-WEB-2C4: the session cookie outlives the
 * access token, so users were bounced to /login mid-session and proxied API calls 401ed). Refresh
 * only happens once the token is actually expired, and concurrent requests carrying the same
 * refresh token share a single in-flight `/oauth/token` call — with Auth0 refresh-token rotation
 * enabled, configure the tenant's rotation *reuse interval* (30–60s) so cross-instance races don't
 * revoke the token family; a lost race degrades to today's unauthenticated behavior, never an error.
 */
export function createGetSessionWithRefresh(deps: GetSessionWithRefreshDependencies): GetSession {
  const inFlightRefreshes = new Map<string, ReturnType<SessionService["refreshAccessToken"]>>();

  function refreshOncePerToken(refreshToken: string) {
    const inFlight = inFlightRefreshes.get(refreshToken);
    if (inFlight) return inFlight;

    const refresh = deps.sessionService.refreshAccessToken(refreshToken).finally(() => {
      inFlightRefreshes.delete(refreshToken);
    });
    inFlightRefreshes.set(refreshToken, refresh);
    return refresh;
  }

  return async function getSessionWithRefresh(req, res) {
    const session = await deps.getSession(req, res);
    if (!session || !isAccessTokenExpired(session) || !session.refreshToken) {
      return session;
    }

    const result = await refreshOncePerToken(session.refreshToken);

    if (!result.ok) {
      deps.logger.warn({ event: "ACCESS_TOKEN_REFRESH_FAILED", code: result.val.code, error: result.val });
      clearSessionCookies(req as NextApiRequest, res as NextApiResponse);
      return session;
    }

    Object.assign(session, result.val);
    try {
      await deps.setSession(req as NextApiRequest, res as NextApiResponse, session);
    } catch (error) {
      deps.logger.warn({ event: "ACCESS_TOKEN_REFRESH_PERSIST_FAILED", error });
    }
    deps.logger.info({ event: "ACCESS_TOKEN_REFRESHED", userId: session.user?.id });

    return session;
  };
}

/** Mirrors the expiry predicate of `pageGuards.isAuthenticated` and the auth0 profile handler. */
function isAccessTokenExpired(session: Session): boolean {
  return (session.accessTokenExpiresAt || 0) * 1_000 <= Date.now();
}
