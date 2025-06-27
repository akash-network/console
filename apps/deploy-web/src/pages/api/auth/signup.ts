import { handleLogin } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";

import { wrapApiHandlerInExecutionContext } from "@src/lib/nextjs/wrapApiHandler";

export default wrapApiHandlerInExecutionContext(async function signup(req: NextApiRequest, res: NextApiResponse) {
  try {
    await handleLogin(req, res, {
      authorizationParams: {
        // Note that this can be combined with prompt=login , which indicates if
        // you want to always show the authentication page or you want to skip
        // if there’s an existing session.
        //screen_hint: "signup" // <== New Universal Signup
        action: "signup" // <== Classic Universal Login
      }
    });
  } catch (error: any) {
    const status = error?.status || 0;
    console.error("auth0 signup error", {
      status,
      message: error.message,
      stack: error.stack,
      error
    });

    if (status >= 500) {
      res.status(503).send({ message: "An unexpected error occurred. Please try again later." });
    } else {
      res.status(400).send({ message: error.message });
    }
  }
});
