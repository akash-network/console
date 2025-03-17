// pages/api/auth/[...auth0].js
import { handleAuth, handleLogin, handleProfile } from "@auth0/nextjs-auth0";
import axios, { AxiosHeaders } from "axios";
import type { NextApiRequest, NextApiResponse } from "next";

import { serverEnvConfig } from "@src/config/server-env.config";

export default handleAuth({
  async login(req: NextApiRequest, res: NextApiResponse) {
    const returnUrl = decodeURIComponent((req.query.from as string) ?? "/");

    await handleLogin(req, res, {
      returnTo: returnUrl
    });
  },
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

            const userSettings = await axios.post(
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
      res.status(error.status || 400).end(error.message);
    }
  }
});
