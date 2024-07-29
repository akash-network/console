// pages/api/auth/[...auth0].js
import { handleAuth, handleLogin, handleProfile } from "@auth0/nextjs-auth0";
import axios, { AxiosRequestHeaders } from "axios";
import type { NextApiRequest, NextApiResponse } from "next";

import { BASE_API_MAINNET_URL } from "@src/utils/constants";

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
            // TODO: Fix for console
            const user_metadata = session.user["https://console.akash.network/user_metadata"];
            const headers: AxiosRequestHeaders = {
              Authorization: `Bearer ${session.accessToken}`
            };

            const anonymousId = req.headers["x-anonymous-user-id"];

            if (anonymousId) {
              headers["X-ANONYMOUS-USER-ID"] = anonymousId as string;
            }

            const userSettings = await axios.post(
              `${BASE_API_MAINNET_URL}/user/tokenInfo`,
              {
                wantedUsername: session.user.nickname,
                email: session.user.email,
                emailVerified: session.user.email_verified,
                subscribedToNewsletter: user_metadata?.subscribedToNewsletter === "true"
              },
              {
                headers
              }
            );

            // session.user["user_metadata"] = { ...session.user["https://console.akash.network/user_metadata"] };
            // delete session.user["https://console.akash.network/user_metadata"];

            session.user = { ...session.user, ...userSettings.data };
          } catch (err) {
            console.error(err);
          }

          return session;
        }
      });
    } catch (error) {
      res.status(error.status || 400).end(error.message);
    }
  }
});
