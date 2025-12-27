import { handleLogin } from "@src/lib/auth0";
import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { rewriteLocalRedirect } from "@src/services/auth/auth/rewrite-local-redirect";
import type { SeverityLevel } from "@src/services/error-handler/error-handler.service";

export default defineApiHandler({
  route: "/api/auth/signup",
  async handler({ res, req, services }) {
    try {
      if (services.config.AUTH0_LOCAL_ENABLED && services.config.AUTH0_REDIRECT_BASE_URL) {
        rewriteLocalRedirect(res, services.config);
      }

      const returnUrl = decodeURIComponent((req.query.returnTo as string) ?? "/");

      await handleLogin(req, res, {
        returnTo: returnUrl,
        authorizationParams: {
          // Note that this can be combined with prompt=login , which indicates if
          // you want to always show the authentication page or you want to skip
          // if there's an existing session.
          //screen_hint: "signup" // <== New Universal Signup
          action: "signup", // <== Classic Universal Login
          connection: req.query.connection as string | undefined
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
