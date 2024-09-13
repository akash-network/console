import { NextApiRequest, NextApiResponse } from "next";

import GitHubAuth from "@src/services/auth/github.service";

const { NEXT_PUBLIC_GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, NEXT_PUBLIC_REDIRECT_URI } = process.env;

export default async function exchangeGitHubCodeForTokenHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { code }: { code: string } = req.body;

  if (!code) {
    return res.status(400).send("No authorization code provided");
  }

  const gitHubAuth = new GitHubAuth(NEXT_PUBLIC_GITHUB_CLIENT_ID as string, GITHUB_CLIENT_SECRET as string, NEXT_PUBLIC_REDIRECT_URI as string);

  try {
    const access_token = await gitHubAuth.exchangeAuthorizationCodeForToken(code);
    res.status(200).json({ access_token });
  } catch (error) {
    res.status(500).send("Something went wrong");
  }
}
