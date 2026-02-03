import { handleAuth, handleCallback, handleLogin, handleLogout } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";

export default handleAuth({
  async login(req: NextApiRequest, res: NextApiResponse) {
    await handleLogin(req, res, {
      authorizationParams: {
        audience: process.env.AUTH0_AUDIENCE,
        scope: "openid profile email"
      },
      returnTo: "/users"
    });
  },
  async logout(req: NextApiRequest, res: NextApiResponse) {
    await handleLogout(req, res, {
      returnTo: process.env.AUTH0_BASE_URL
    });
  },
  async callback(req: NextApiRequest, res: NextApiResponse) {
    try {
      await handleCallback(req, res, {
        redirectUri: `${process.env.AUTH0_BASE_URL}/api/auth/callback`
      });
    } catch (error: unknown) {
      const status = error instanceof Error && "status" in error ? (error as { status: number }).status : 500;
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(status).end(message);
    }
  }
});
