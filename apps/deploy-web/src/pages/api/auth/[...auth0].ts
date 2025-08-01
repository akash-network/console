// pages/api/auth/[...auth0].js
import { handleAuth, handleLogin, handleLogout, handleProfile } from "@auth0/nextjs-auth0";
import { AxiosHeaders } from "axios";
import { once } from "lodash";
import type { NextApiRequest, NextApiResponse } from "next";

import type { ServerEnvConfig } from "@src/config/env-config.schema";
import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import type { SeverityLevel } from "@src/services/error-handler/error-handler.service";
import type { AppServices } from "@src/services/http/http-server.service";

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
      if (services.config.AUTH0_LOCAL_ENABLED && services.config.AUTH0_REDIRECT_BASE_URL) {
        rewriteLocalRedirect(res, services.config);
      }

      await handleLogin(req, res, {
        returnTo: returnUrl,
        // Reduce the scope to minimize session data
        authorizationParams: {
          scope: "openid profile email"
        }
      });
    },
    logout: services.config.AUTH0_LOCAL_ENABLED
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
        await handleProfile(req, res, {
          refetch: true,
          afterRefetch: async (req, res, session) => {
            try {
              const user_metadata = session.user["https://console.akash.network/user_metadata"];
              const headers = new AxiosHeaders({
                Authorization: `Bearer ${session.accessToken}`
              });

              const anonymousAuthorization = req.headers.authorization;

              if (anonymousAuthorization) {
                headers.set("x-anonymous-authorization", anonymousAuthorization);
              }

              const userSettings = await services.consoleApiHttpClient.post(
                `${services.apiUrlService.getBaseApiUrlFor("mainnet")}/user/tokenInfo`,
                {
                  wantedUsername: session.user.nickname,
                  email: session.user.email,
                  emailVerified: session.user.email_verified,
                  subscribedToNewsletter: user_metadata?.subscribedToNewsletter === "true"
                },
                {
                  headers: headers.toJSON()
                }
              );

              session.user = { ...session.user, ...userSettings.data };
            } catch (error) {
              services.errorHandler.reportError({ error, tags: { category: "auth0" } });
            }

            return session;
          }
        });
      } catch (error: any) {
        let severity: SeverityLevel = "error";
        if (error?.status && error.status >= 400 && error.status < 500) {
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

function rewriteLocalRedirect(res: NextApiResponse<any>, config: Pick<ServerEnvConfig, "AUTH0_REDIRECT_BASE_URL" | "AUTH0_ISSUER_BASE_URL">) {
  const redirect = res.redirect;

  res.redirect = function rewriteLocalRedirect(urlOrStatus: string | number, maybeUrl?: string): NextApiResponse<any> {
    const code = typeof urlOrStatus === "string" ? 302 : urlOrStatus;
    const inputUrl = typeof urlOrStatus === "string" ? urlOrStatus : maybeUrl;
    const rewritten = config.AUTH0_REDIRECT_BASE_URL ? inputUrl!.replace(config.AUTH0_ISSUER_BASE_URL, config.AUTH0_REDIRECT_BASE_URL || "") : inputUrl!;

    return redirect.apply(this, [code, rewritten]);
  };
}
