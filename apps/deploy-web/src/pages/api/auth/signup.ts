import { handleLogin } from "@auth0/nextjs-auth0";

import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import type { SeverityLevel } from "@src/services/error-handler/error-handler.service";

export default defineApiHandler({
  route: "/api/auth/signup",
  async handler({ res, req, services }) {
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
      let severity: SeverityLevel = "error";
      if (error?.status && error.status >= 400 && error.status < 500) {
        severity = "warning";
        res.status(400).send({ message: error.message });
      } else {
        res.status(503).send({ message: "An unexpected error occurred. Please try again later." });
      }
      services.errorHandler.reportError({ severity, error, tags: { category: "auth0", event: "AUTH_SIGNUP_ERROR" } });
    }
  }
});
