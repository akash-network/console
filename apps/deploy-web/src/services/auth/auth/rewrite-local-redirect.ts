import type { NextApiResponse } from "next";

import type { ServerEnvConfig } from "@src/config/env-config.schema";

export function rewriteLocalRedirect(res: NextApiResponse<any>, config: Pick<ServerEnvConfig, "AUTH0_REDIRECT_BASE_URL" | "AUTH0_ISSUER_BASE_URL">) {
  const redirect = res.redirect;

  res.redirect = function rewriteLocalRedirect(urlOrStatus: string | number, maybeUrl?: string): NextApiResponse<any> {
    const code = typeof urlOrStatus === "string" ? 302 : urlOrStatus;
    const inputUrl = typeof urlOrStatus === "string" ? urlOrStatus : maybeUrl;
    const rewritten = config.AUTH0_REDIRECT_BASE_URL ? inputUrl!.replace(config.AUTH0_ISSUER_BASE_URL, config.AUTH0_REDIRECT_BASE_URL || "") : inputUrl!;

    return redirect.apply(this, [code, rewritten]);
  };
}
