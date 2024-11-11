import { NextApiRequest, NextApiResponse } from "next";

import { serverEnvConfig } from "@src/config/server-env.config";
import GitlabAuth from "@src/services/auth/gitlab.service";

const { NEXT_PUBLIC_GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET } = serverEnvConfig;

export default async function refreshGitLabTokensHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { refreshToken }: { refreshToken: string } = req.body;

  if (!refreshToken) {
    return res.status(400).send({
      error: "BadRequestError",
      message: "No refresh token provided"
    });
  }

  const gitlabAuth = new GitlabAuth(NEXT_PUBLIC_GITLAB_CLIENT_ID as string, GITLAB_CLIENT_SECRET as string);

  try {
    const tokens = await gitlabAuth.refreshTokensUsingRefreshToken(refreshToken);
    res.status(200).json(tokens);
  } catch (error) {
    res.status(500).send({
      error: error.response?.data?.error,
      message: error.response?.data?.error_description
    });
  }
}
