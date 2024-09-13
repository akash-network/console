import { NextApiRequest, NextApiResponse } from "next";

import GitlabAuth from "@src/services/auth/gitlab.service";

const { NEXT_PUBLIC_GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET } = process.env;

export default async function refreshGitLabTokensHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { refreshToken }: { refreshToken: string } = req.body;

  if (!refreshToken) {
    return res.status(400).send("No refresh token provided");
  }

  const gitlabAuth = new GitlabAuth(NEXT_PUBLIC_GITLAB_CLIENT_ID as string, GITLAB_CLIENT_SECRET as string);

  try {
    const { access_token, refresh_token } = await gitlabAuth.refreshTokensUsingRefreshToken(refreshToken);
    res.status(200).json({ access_token, refresh_token });
  } catch (error) {
    res.status(500).send("Something went wrong");
  }
}
