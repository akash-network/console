import { getSession } from "@auth0/nextjs-auth0";
import httpProxy from "http-proxy";
import type { NextApiRequest, NextApiResponse } from "next";

import { serverEnvConfig } from "@src/config/server-env.config";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  // removes the api prefix from url
  req.url = req.url?.replace(/^\/api\/proxy/, "");

  console.log("proxy:", req.url);
  const session = await getSession(req, res);

  // Extract and forward only cf_clearance cookie if present
  const cookies = req.headers.cookie?.split(";").map(c => c.trim());
  const cfClearance = cookies?.find(c => c.startsWith("cf_clearance="));
  req.headers.cookie = cfClearance || "";

  if (session?.accessToken) {
    req.headers.authorization = `Bearer ${session.accessToken}`;
  }

  const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    target: serverEnvConfig.BASE_API_MAINNET_URL,
    secure: false,
    autoRewrite: false
  });

  return new Promise((resolve, reject) => {
    proxy
      .once("proxyRes", () => resolve(undefined))
      .once("error", (error: Error) => {
        console.log("proxy error:", error);
        reject();
      })
      .web(req, res);
  });
};

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false
  }
};
