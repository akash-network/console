import { NextApiRequest, NextApiResponse } from "next";

import GitlabAuth from "@src/services/auth/gitlab.service";

const { NEXT_PUBLIC_GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET, NEXT_PUBLIC_REDIRECT_URI } = process.env;

export default async function exchangeGitLabCodeForTokensHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { code }: { code: string } = req.body;

  if (!code) {
    return res.status(400).send("No authorization code provided");
  }

  const gitlabAuth = new GitlabAuth(NEXT_PUBLIC_GITLAB_CLIENT_ID as string, GITLAB_CLIENT_SECRET as string, NEXT_PUBLIC_REDIRECT_URI as string);

  try {
    const { access_token, refresh_token } = await gitlabAuth.exchangeAuthorizationCodeForTokens(code);
    res.status(200).json({ access_token, refresh_token });
  } catch (error) {
    res.status(500).send(error);
  }
}
