// pages/api/auth/[...auth0].js
import { handleAuth, handleLogin, handleLogout, handleProfile } from "@auth0/nextjs-auth0";
import { AxiosHeaders } from "axios";
import type { NextApiRequest, NextApiResponse } from "next";

import { serverEnvConfig } from "@src/config/server-env.config";
import { wrapApiHandlerInExecutionContext } from "@src/lib/nextjs/wrapApiHandler";
import { services } from "@src/services/http/http-server.service";

export default wrapApiHandlerInExecutionContext(
  handleAuth({
    async login(req: NextApiRequest, res: NextApiResponse) {
      const returnUrl = decodeURIComponent((req.query.from as string) ?? "/");
      rewriteLocalRedirect(res);

      await handleLogin(req, res, {
        returnTo: returnUrl
      });
    },
    logout: serverEnvConfig.AUTH0_LOCAL_ENABLED
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
      console.log("server /profile", req.url);
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

              const userSettings = await services.axios.post(
                `${serverEnvConfig.BASE_API_MAINNET_URL}/user/tokenInfo`,
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
            } catch (err) {
              console.error(err);
            }

            return session;
          }
        });
      } catch (error: any) {
        const status = error?.status || 0;
        console.error("auth0 signup error", {
          status,
          message: error.message,
          stack: error.stack,
          error
        });

        if (status >= 500) {
          res.status(503).send({ message: "An unexpected error occurred. Please try again later." });
        } else {
          res.status(400).send({ message: error.message });
        }
      }
    }
  })
);

function rewriteLocalRedirect(res: NextApiResponse<any>) {
  if (serverEnvConfig.AUTH0_LOCAL_ENABLED && serverEnvConfig.AUTH0_REDIRECT_BASE_URL) {
    const redirect = res.redirect;

    res.redirect = function rewriteLocalRedirect(urlOrStatus: string | number, maybeUrl?: string): NextApiResponse<any> {
      const code = typeof urlOrStatus === "string" ? 302 : urlOrStatus;
      const inputUrl = typeof urlOrStatus === "string" ? urlOrStatus : maybeUrl;
      const rewritten = serverEnvConfig.AUTH0_REDIRECT_BASE_URL
        ? inputUrl!.replace(serverEnvConfig.AUTH0_ISSUER_BASE_URL, serverEnvConfig.AUTH0_REDIRECT_BASE_URL || "")
        : inputUrl!;

      return redirect.apply(this, [code, rewritten]);
    };
  }
}
