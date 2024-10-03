import { NextApiRequest, NextApiResponse } from "next";

import { serverEnvConfig } from "@src/config/server-env.config";
import BitbucketAuth from "@src/services/auth/bitbucket.service";

const NEXT_PUBLIC_BITBUCKET_CLIENT_ID = serverEnvConfig.NEXT_PUBLIC_BITBUCKET_CLIENT_ID as string;
const BITBUCKET_CLIENT_SECRET = serverEnvConfig.BITBUCKET_CLIENT_SECRET as string;

export default async function refreshTokensHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { refreshToken }: { refreshToken: string } = req.body;

  if (!refreshToken) {
    return res.status(400).send({
      error: "BadRequestError",
      message: "No refresh token provided"
    });
  }

  const bitbucketAuth = new BitbucketAuth(NEXT_PUBLIC_BITBUCKET_CLIENT_ID, BITBUCKET_CLIENT_SECRET);

  try {
    const { access_token, refresh_token } = await bitbucketAuth.refreshTokensUsingRefreshToken(refreshToken);
    res.status(200).json({ access_token, refresh_token });
  } catch (error) {
    res.status(500).send({
      error: error.response?.data?.error,
      message: error.response?.data?.error_description
    });
  }
}
