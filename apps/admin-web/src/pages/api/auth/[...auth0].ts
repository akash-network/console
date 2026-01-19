import { handleAuth, handleCallback, handleLogin } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";

export default handleAuth({
  login: handleLogin({
    authorizationParams: {
      audience: process.env.AUTH0_AUDIENCE,
      scope: "openid profile email"
    },
    returnTo: "/users"
  }),
  callback: async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handleCallback(req, res, {
        redirectUri: `${process.env.AUTH0_BASE_URL}/api/auth/callback`
      });
    } catch (error: unknown) {
      console.error("Auth callback error:", error);
      const status = error instanceof Error && "status" in error ? (error as { status: number }).status : 500;
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(status).end(message);
    }
  }
});
