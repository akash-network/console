import type { Session } from "@auth0/nextjs-auth0";
import { getSession, handleAuth, handleCallback, handleLogin, handleLogout } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";

const ALLOWED_DOMAIN = "akash.network";

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
        redirectUri: `${process.env.AUTH0_BASE_URL}/api/auth/callback`,
        afterCallback: (_req: NextApiRequest, _res: NextApiResponse, session: Session) => {
          const email = session.user?.email?.toLowerCase() || "";
          const domain = email.split("@")[1];

          if (domain !== ALLOWED_DOMAIN) {
            return { ...session, unauthorized: true };
          }
          return session;
        }
      });

      const session = await getSession(req, res);
      if (session?.unauthorized) {
        res.writeHead(302, { Location: "/unauthorized" });
        res.end();
        return;
      }
    } catch (error: unknown) {
      const status = error instanceof Error && "status" in error ? (error as { status: number }).status : 500;
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(status).end(message);
    }
  }
});
