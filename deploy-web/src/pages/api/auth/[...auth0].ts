// pages/api/auth/[...auth0].js
import { handleAuth, handleLogin, handleProfile } from "@auth0/nextjs-auth0";
import { BASE_API_MAINNET_URL } from "@src/utils/constants";
import axios from "axios";

export default handleAuth({
  async login(req, res) {
    const returnUrl = decodeURIComponent((req.query.from as string) ?? "/");

    await handleLogin(req, res, {
      returnTo: returnUrl
    });
  },
  async profile(req, res) {
    console.log("server /profile", req.url);
    try {
      await handleProfile(req, res, {
        refetch: true,
        afterRefetch: async (req, res, session) => {
          try {
            const user_metadata = session.user["https://cloudmos.io/user_metadata"];

            const userSettings = await axios.post(
              `${BASE_API_MAINNET_URL}/user/tokenInfo`,
              {
                wantedUsername: session.user.nickname,
                email: session.user.email,
                emailVerified: session.user.email_verified,
                subscribedToNewsletter: user_metadata?.subscribedToNewsletter === "true",
                accountType: "cloudmos"
              },
              {
                headers: {
                  Authorization: `Bearer ${session.accessToken}`
                }
              }
            );

            // session.user["user_metadata"] = { ...session.user["https://cloudmos.io/user_metadata"] };
            // delete session.user["https://cloudmos.io/user_metadata"];

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
