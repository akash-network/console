/**
 * !!! IMPORTANT !!!
 * This file is a hacky workaround to create user session from auth0 API response.
 * nextjs-auth0 is not going to support this any time soon.
 * See https://github.com/auth0/nextjs-auth0/issues/972 for more details.
 *
 * Solution consists of several parts:
 * 1. next.config.js changes: we compile @auth0/nextjs-auth0 with webpack and add aliases to internal modules
 *    in order to reference them in this file. For this reason @auth0/nextjs-auth0 is specified in `transpilePackages` array.
 * 2. Jest setup: we also need to adjust Jest config to transform @auth0/nextjs-auth0 in the same way we did this in next.config.js.
 * 3. Detecting internal sessionCache variable by patching `updateSessionFactory` function. This variable is needed
 *    later to set the session in the correct session cache instance.
 * 4. `setSession` implementation which is basically an adoption of `updateSession` function
 */

import type { Session, SessionCache } from "@auth0/nextjs-auth0"; // eslint-disable-line no-restricted-imports
import { getSession as auth0GetSession } from "@auth0/nextjs-auth0"; // eslint-disable-line no-restricted-imports
// @ts-expect-error - access to internal function via webpack alias in next.config.js#72
import * as sessionModule from "@auth0/nextjs-auth0/session";
// @ts-expect-error - access to internal function via webpack alias in next.config.js#72
import * as updateSessionModule from "@auth0/nextjs-auth0/update-session";
import type { NextApiRequest, NextApiResponse } from "next";

const originalUpdateSessionFactory = updateSessionModule.default;
let globalSessionCache: SessionCache | undefined;
updateSessionModule.default = (sessionCache: SessionCache) => {
  globalSessionCache = sessionCache;
  return originalUpdateSessionFactory(sessionCache);
};

async function ensureSessionCacheInitialized(req?: NextApiRequest, res?: NextApiResponse): Promise<void> {
  if (globalSessionCache) {
    return;
  }

  try {
    if (req && res) {
      await auth0GetSession(req, res);
    } else {
      await auth0GetSession();
    }
  } catch {
    // we only care about triggering the SDK initialization so the SessionCache instance is captured
  }
}

export async function setSession(reqOrSession: NextApiRequest | Session, res: NextApiResponse | undefined, newSession: Session): Promise<void> {
  const req = res ? (reqOrSession as NextApiRequest) : undefined;

  await ensureSessionCacheInitialized(req, res);

  const sessionCache = globalSessionCache;

  if (!sessionCache) {
    throw new Error("Cannot create session: SessionCache cache was not automatically discovered");
  }

  const session = res ? newSession : reqOrSession;
  await sessionModule.set({ req, res, session, sessionCache });
}
