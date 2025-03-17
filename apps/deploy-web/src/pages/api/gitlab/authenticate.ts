import { NextApiRequest, NextApiResponse } from "next";

import { serverEnvConfig } from "@src/config/server-env.config";
import GitlabAuth from "@src/services/auth/gitlab.service";

const { NEXT_PUBLIC_GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET, NEXT_PUBLIC_REDIRECT_URI } = serverEnvConfig;

export default async function exchangeGitLabCodeForTokensHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { code }: { code: string } = req.body;

  if (!code) {
    return res.status(400).send({
      error: "BadRequestError",
      message: "No authorization code provided"
    });
  }

  const gitlabAuth = new GitlabAuth(NEXT_PUBLIC_GITLAB_CLIENT_ID as string, GITLAB_CLIENT_SECRET as string, NEXT_PUBLIC_REDIRECT_URI as string);

  try {
    const tokens = await gitlabAuth.exchangeAuthorizationCodeForTokens(code);
    res.status(200).json(tokens);
  } catch (error: any) {
    res.status(500).send({
      error: error.response?.data?.error,
      message: error.response?.data?.error_description
    });
  }
}
