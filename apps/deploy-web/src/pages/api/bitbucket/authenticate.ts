import type { NextApiRequest, NextApiResponse } from "next";

import { serverEnvConfig } from "@src/config/server-env.config";
import { wrapApiHandlerInExecutionContext } from "@src/lib/nextjs/wrapApiHandler";
import BitbucketAuth from "@src/services/auth/bitbucket.service";
const NEXT_PUBLIC_BITBUCKET_CLIENT_ID = serverEnvConfig.NEXT_PUBLIC_BITBUCKET_CLIENT_ID as string;
const BITBUCKET_CLIENT_SECRET = serverEnvConfig.BITBUCKET_CLIENT_SECRET as string;

export default wrapApiHandlerInExecutionContext(async function exchangeBitBucketCodeForTokensHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { code }: { code: string } = req.body;

  if (!code) {
    return res.status(400).send({
      error: "BadRequestError",
      message: "No authorization code provided"
    });
  }

  const bitbucketAuth = new BitbucketAuth(NEXT_PUBLIC_BITBUCKET_CLIENT_ID, BITBUCKET_CLIENT_SECRET);

  try {
    const tokens = await bitbucketAuth.exchangeAuthorizationCodeForTokens(code);
    res.status(200).json(tokens);
  } catch (error: any) {
    console.error("bitbucket authenticate error", {
      status: error.response?.status || 0,
      message: error.response?.data?.error_description,
      error
    });

    res.status(500).end("An unexpected error occurred. Please try again later.");
  }
});
