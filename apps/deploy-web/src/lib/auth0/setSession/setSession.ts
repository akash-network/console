/**
 * !!! IMPORTANT !!!
 * This file is a hacky workaround to create user session from auth0 API response.
 * nextjs-auth0 is not going to support this any time soon.
 * See https://github.com/auth0/nextjs-auth0/issues/972 for more details.
 *
 * Solution: Access Auth0's internal getConfig and SessionCache to create sessions programmatically.
 * This requires webpack aliases in next.config.js to expose internal modules.
 */

import type { Session } from "@auth0/nextjs-auth0";
// @ts-expect-error - access to internal function via webpack alias in next.config.js
import { getConfig } from "@auth0/nextjs-auth0/config";
// @ts-expect-error - access to internal function via webpack alias in next.config.js
import * as sessionModule from "@auth0/nextjs-auth0/session";
import type { NextApiRequest, NextApiResponse } from "next";

let cachedSessionCache: InstanceType<typeof sessionModule.SessionCache> | undefined;

function getSessionCache(): InstanceType<typeof sessionModule.SessionCache> {
  if (!cachedSessionCache) {
    // SessionCache constructor expects getConfig function directly (not wrapped in object)
    cachedSessionCache = new sessionModule.SessionCache(getConfig);
  }
  return cachedSessionCache;
}

export async function setSession(
  reqOrSession: NextApiRequest | Session,
  res: NextApiResponse | undefined,
  newSession: Session,
  sessionModuleOverride?: typeof sessionModule
): Promise<void> {
  const auth0SessionModule = sessionModuleOverride ?? sessionModule;
  const req = res ? (reqOrSession as NextApiRequest) : undefined;
  const sessionCache = getSessionCache();
  const session = res ? newSession : reqOrSession;
  await auth0SessionModule.set({ req, res, session, sessionCache });
}
