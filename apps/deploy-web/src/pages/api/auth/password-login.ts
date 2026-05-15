import { z } from "zod";

import { setSession } from "@src/lib/auth0/setSession/setSession";
import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { verifyCaptcha } from "@src/middleware/verify-captcha/verify-captcha";

export default defineApiHandler({
  route: "/api/auth/password-login",
  method: "POST",
  schema: z.object({
    body: z.object({
      email: z.string().email(),
      password: z.string(),
      captchaToken: z.string()
    })
  }),
  async handler(ctx) {
    const { res, req, services, body } = ctx;

    const verification = await verifyCaptcha(body.captchaToken, ctx);
    if (verification.err) return res.status(400).json(verification.val);

    const result = await services.sessionService.signIn({
      email: req.body.email,
      password: req.body.password
    });

    if (result.ok) {
      await setSession(req, res, result.val);
      res.status(204).json(null);
      return;
    }

    const { cause, ...errorDetails } = result.val;
    services.logger.warn({
      event: "PASSWORD_LOGIN_ERROR",
      cause: result.val
    });
    return res.status(400).json(errorDetails);
  }
});
