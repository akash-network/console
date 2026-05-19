import { z } from "zod";

import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { verifyCaptcha } from "@src/middleware/verify-captcha/verify-captcha";

export default defineApiHandler({
  route: "/api/auth/email-code-start",
  method: "POST",
  schema: z.object({
    body: z.object({
      email: z.string().email(),
      captchaToken: z.string()
    })
  }),
  async handler(ctx) {
    const { res, services, body } = ctx;

    const verification = await verifyCaptcha(body.captchaToken, ctx);
    if (verification.err) return res.status(400).json(verification.val);

    const result = await services.sessionService.startEmailCode({ email: body.email });

    if (result.ok) {
      res.status(204).end();
      return;
    }

    const { cause: _cause, ...errorDetails } = result.val;
    services.logger.warn({ event: "EMAIL_CODE_START_ERROR", cause: result.val });
    if (errorDetails.code === "rate_limited") {
      if (errorDetails.retryAfter) res.setHeader("Retry-After", String(errorDetails.retryAfter));
      return res.status(429).json(errorDetails);
    }
    return res.status(400).json(errorDetails);
  }
});
