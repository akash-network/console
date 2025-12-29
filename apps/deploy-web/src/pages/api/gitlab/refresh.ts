import { z } from "zod";

import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import GitlabAuth from "@src/services/auth/gitlab.service";

export default defineApiHandler({
  route: "/api/gitlab/refresh",
  schema: z.object({
    body: z.object({
      refreshToken: z.string()
    })
  }),
  async handler({ body, res, services }) {
    const { NEXT_PUBLIC_GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET } = services.privateConfig;
    const gitlabAuth = new GitlabAuth(NEXT_PUBLIC_GITLAB_CLIENT_ID as string, GITLAB_CLIENT_SECRET as string, undefined, services.externalApiHttpClient);

    const tokens = await gitlabAuth.refreshTokensUsingRefreshToken(body.refreshToken);
    res.status(200).json(tokens);
  }
});
