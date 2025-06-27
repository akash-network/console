import type { NextApiRequest, NextApiResponse } from "next";

import { serverEnvConfig } from "@src/config/server-env.config";
import { wrapApiHandlerInExecutionContext } from "@src/lib/nextjs/wrapApiHandler";
import GitHubAuth from "@src/services/auth/github.service";

const { NEXT_PUBLIC_GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, NEXT_PUBLIC_REDIRECT_URI } = serverEnvConfig;

export default wrapApiHandlerInExecutionContext(async function exchangeGitHubCodeForTokenHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
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
    console.error("github authenticate error", {
      status: error.response?.status || 0,
      message: error.response?.data?.error_description,
      error
    });

    res.status(500).end("An unexpected error occurred. Please try again later.");
  }
});
