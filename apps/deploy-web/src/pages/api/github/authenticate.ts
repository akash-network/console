import { z } from "zod";

import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import GitHubAuth from "@src/services/auth/github.service";

export default defineApiHandler({
  route: "/api/github/authenticate",
  schema: z.object({
    body: z.object({
      code: z.string()
    })
  }),
  async handler({ body, res, services }) {
    const { NEXT_PUBLIC_GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, NEXT_PUBLIC_REDIRECT_URI } = services.config;
    const gitHubAuth = new GitHubAuth(NEXT_PUBLIC_GITHUB_CLIENT_ID as string, GITHUB_CLIENT_SECRET as string, NEXT_PUBLIC_REDIRECT_URI as string);

    const accessToken = await gitHubAuth.exchangeAuthorizationCodeForToken(body.code);
    res.status(200).json({ accessToken });
  }
});
