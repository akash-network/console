// pages/api/auth/[...auth0].js
import type { AxiosError } from "axios";
import { isAxiosError } from "axios";
import { once } from "lodash";
import type { NextApiRequest, NextApiResponse } from "next";

import type { Session } from "@src/lib/auth0";
import { AccessTokenError, AccessTokenErrorCode, getSession } from "@src/lib/auth0";
import { handleAuth, handleCallback, handleLogin, handleLogout } from "@src/lib/auth0";
import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import type { AppServices } from "@src/services/app-di-container/server-di-container.service";
import { rewriteLocalRedirect } from "@src/services/auth/auth/rewrite-local-redirect";
import type { SeverityLevel } from "@src/services/error-handler/error-handler.service";
import { ANONYMOUS_HEADER_COOKIE_NAME } from "./signup";

export default defineApiHandler({
  route: "/api/auth/[...auth0]",
  async handler({ res, req, services }) {
    await authHandler(services)(req, res);
  }
});

const authHandler = once((services: AppServices) =>
  handleAuth({
    async login(req: NextApiRequest, res: NextApiResponse) {
      const returnUrl = decodeURIComponent((req.query.from as string) ?? "/");
      if (services.privateConfig.AUTH0_LOCAL_ENABLED && services.privateConfig.AUTH0_REDIRECT_BASE_URL) {
        rewriteLocalRedirect(res, services.privateConfig);
      }

      await handleLogin(req, res, {
        returnTo: returnUrl,
        // Reduce the scope to minimize session data
        authorizationParams: {
          scope: "openid profile email offline_access",
          connection: req.query.connection as string | undefined
        }
      });
    },
    async callback(req: NextApiRequest, res: NextApiResponse) {
      try {
        await handleCallback(req, res, {
          afterCallback: async (req: NextApiRequest, res: NextApiResponse, session: Session) => {
            try {
              const userSettings = await services.sessionService.createLocalUser(session);
              session.user = { ...session.user, ...userSettings };
              const isSecure = services.privateConfig.NODE_ENV === "production";
              res.setHeader(
                "Set-Cookie",
                `${ANONYMOUS_HEADER_COOKIE_NAME}=; Path=/api/auth/callback; HttpOnly; ${isSecure ? "Secure;" : ""} SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
              );
            } catch (error) {
              services.errorHandler.reportError({ error, tags: { category: "auth0" } });
            }

            return session;
          }
        });
      } catch (error) {
        services.errorHandler.reportError({ error, tags: { category: "auth0", event: "AUTH_CALLBACK_ERROR" } });
        throw error;
      }
    },
    logout: services.privateConfig.AUTH0_LOCAL_ENABLED
      ? async function (req: NextApiRequest, res: NextApiResponse) {
          const cookies = req.cookies;
          const expiredCookies = Object.keys(cookies)
            .filter(key => key.startsWith("appSession"))
            .map(key => `${key}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);

          res.setHeader("Set-Cookie", expiredCookies);
          res.writeHead(302, { Location: "/" });

          res.end();
        }
      : handleLogout,
    async profile(req: NextApiRequest, res: NextApiResponse) {
      services.logger.info({ event: "AUTH_PROFILE_REQUEST", url: req.url });
      try {
        const session = await getSession(req, res);
        if (!session) {
          services.logger.info({ event: "AUTH_PROFILE_REQUEST_NO_SESSION", url: req.url });
          res.status(401).json({ error: "Not authenticated" });
          return;
        }

        const userSettings = await services.sessionService.getLocalUserDetails(session).catch(error => {
          services.errorHandler.reportError({ error, tags: { category: "auth0", event: "AUTH_GET_LOCAL_PROFILE_ERROR" } });
          return undefined;
        });

        res.json({ ...session.user, ...userSettings });
      } catch (error: unknown) {
        if (isInvalidSessionError(error)) {
          services.logger.warn({ event: "AUTH_SESSION_INVALID", url: req.url });
          clearSessionAndRedirectToLogin(req, res);
          return;
        }
        let severity: SeverityLevel = "error";
        if (isGeneralAxiosError(error)) {
          severity = "warning";
          res.status(400).send({ message: error.message });
        } else {
          res.status(503).send({ message: "An unexpected error occurred. Please try again later." });
        }
        services.errorHandler.reportError({ severity, error, tags: { category: "auth0", event: "AUTH_PROFILE_ERROR" } });
      }
    }
  })
);

function isInvalidSessionError(error: unknown): boolean {
  if (!(error instanceof AccessTokenError)) {
    return false;
  }

  const invalidSessionCodes: string[] = [AccessTokenErrorCode.EXPIRED_ACCESS_TOKEN, AccessTokenErrorCode.FAILED_REFRESH_GRANT];

  return invalidSessionCodes.includes(error.code);
}

function isGeneralAxiosError(error: unknown): error is AxiosError {
  return isAxiosError(error) && !!error?.status && error.status >= 400 && error.status < 500;
}

function clearSessionAndRedirectToLogin(req: NextApiRequest, res: NextApiResponse): void {
  // Clear invalid session cookies before redirecting
  const cookies = req.cookies;
  const expiredCookies = Object.keys(cookies)
    .filter(key => key.startsWith("appSession"))
    .map(key => `${key}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);

  if (expiredCookies.length > 0) {
    res.setHeader("Set-Cookie", expiredCookies);
  }

  const returnUrl = encodeURIComponent(req.url || "/");
  const loginUrl = `/api/auth/login?from=${returnUrl}`;
  res.writeHead(302, { Location: loginUrl });
  res.end();
}
