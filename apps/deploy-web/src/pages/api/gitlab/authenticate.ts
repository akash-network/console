import { z } from "zod";

import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import GitlabAuth from "@src/services/auth/gitlab.service";

export default defineApiHandler({
  route: "/api/gitlab/authenticate",
  schema: z.object({
    body: z.object({
      code: z.string()
    })
  }),
  async handler({ body, res, services }) {
    const { NEXT_PUBLIC_GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET, NEXT_PUBLIC_REDIRECT_URI } = services.config;
    const gitlabAuth = new GitlabAuth(NEXT_PUBLIC_GITLAB_CLIENT_ID as string, GITLAB_CLIENT_SECRET as string, NEXT_PUBLIC_REDIRECT_URI as string);

    const tokens = await gitlabAuth.exchangeAuthorizationCodeForTokens(body.code);
    res.status(200).json(tokens);
  }
});
