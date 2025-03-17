import { NextApiRequest, NextApiResponse } from "next";

import { serverEnvConfig } from "@src/config/server-env.config";
import GitHubAuth from "@src/services/auth/github.service";

const { NEXT_PUBLIC_GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, NEXT_PUBLIC_REDIRECT_URI } = serverEnvConfig;

export default async function exchangeGitHubCodeForTokenHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { code }: { code: string } = req.body;

  if (!code) {
    return res.status(400).send({
      error: "BadRequestError",
      message: "No authorization code provided"
    });
  }

  const gitHubAuth = new GitHubAuth(NEXT_PUBLIC_GITHUB_CLIENT_ID as string, GITHUB_CLIENT_SECRET as string, NEXT_PUBLIC_REDIRECT_URI as string);

  try {
    const accessToken = await gitHubAuth.exchangeAuthorizationCodeForToken(code);
    res.status(200).json({ accessToken });
  } catch (error: any) {
    res.status(500).send({
      error: "Something went wrong",
      message: error
    });
  }
}
