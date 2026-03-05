import { z } from "zod";

import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { verifyCaptcha } from "@src/middleware/verify-captcha/verify-captcha";

export default defineApiHandler({
  route: "/api/auth/send-password-reset-email",
  method: "POST",
  schema: z.object({
    body: z.object({
      email: z.string().email(),
      captchaToken: z.string()
    })
  }),
  async handler(ctx) {
    const { res, req, services, body } = ctx;

    try {
      const verification = await verifyCaptcha(body.captchaToken, ctx);
      if (verification.err) return res.status(400).json(verification.val);

      const result = await services.sessionService.sendPasswordResetEmail({ email: req.body.email });
      if (result.ok) {
        res.status(204).end();
        return;
      }

      if (result.val.code === "too_many_requests") {
        res.setHeader("Retry-After", new Date(result.val.retryAfter * 1000).toUTCString());
        return res.status(429).json(result.val);
      }

      const { cause, ...errorDetails } = result.val;
      services.logger.warn({
        event: "SEND_PASSWORD_RESET_EMAIL_ERROR",
        cause: result.val
      });
      return res.status(400).json(errorDetails);
    } catch (error) {
      services.logger.error({
        event: "SEND_PASSWORD_RESET_EMAIL_FATAL_ERROR",
        error
      });
      return res.status(503).json({ message: "Service unavailable" });
    }
  }
});
