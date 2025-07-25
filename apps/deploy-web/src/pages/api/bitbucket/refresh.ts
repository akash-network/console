import { z } from "zod";

import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import BitbucketAuth from "@src/services/auth/bitbucket.service";

export default defineApiHandler({
  route: "/api/bitbucket/refresh",
  schema: z.object({
    body: z.object({
      refreshToken: z.string()
    })
  }),
  async handler({ body, res, services }) {
    const { NEXT_PUBLIC_BITBUCKET_CLIENT_ID, BITBUCKET_CLIENT_SECRET } = services.config;
    const bitbucketAuth = new BitbucketAuth(NEXT_PUBLIC_BITBUCKET_CLIENT_ID!, BITBUCKET_CLIENT_SECRET, services.externalApiHttpClient);

    const tokens = await bitbucketAuth.refreshTokensUsingRefreshToken(body.refreshToken);
    res.status(200).json(tokens);
  }
});
