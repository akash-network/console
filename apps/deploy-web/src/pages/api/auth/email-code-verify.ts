import { z } from "zod";

import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { verifyCaptcha } from "@src/middleware/verify-captcha/verify-captcha";

export default defineApiHandler({
  route: "/api/auth/email-code-verify",
  method: "POST",
  schema: z.object({
    body: z.object({
      email: z.string().email(),
      code: z.string().regex(/^\d{6}$/),
      captchaToken: z.string()
    })
  }),
  async handler(ctx) {
    const { req, res, services, body } = ctx;

    const verification = await verifyCaptcha(body.captchaToken, ctx);
    if (verification.err) return res.status(400).json(verification.val);

    const result = await services.sessionService.verifyEmailCode({ email: body.email, code: body.code });

    if (result.ok) {
      await services.sessionService.createLocalUser(result.val);
      await services.setSession(req, res, result.val);
      res.status(204).end();
      return;
    }

    const { cause: _cause, ...errorDetails } = result.val;
    services.logger.warn({ event: "EMAIL_CODE_VERIFY_ERROR", cause: result.val });
    if (errorDetails.code === "rate_limited") {
      if (errorDetails.retryAfter) res.setHeader("Retry-After", String(errorDetails.retryAfter));
      return res.status(429).json(errorDetails);
    }
    return res.status(400).json(errorDetails);
  }
});
