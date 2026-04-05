import { z } from "zod";

import { setSession } from "@src/lib/auth0/setSession/setSession";
import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { verifyCaptcha } from "@src/middleware/verify-captcha/verify-captcha";

const LOWER_LETTER_REGEX = /\p{Ll}/u;
const UPPER_LETTER_REGEX = /\p{Lu}/u;
const DIGIT_REGEX = /\p{Nd}/u;
const SPECIAL_CHAR_REGEX = /[^\p{L}\p{N}]/u;

export default defineApiHandler({
  route: "/api/auth/password-signup",
  method: "POST",
  schema: z.object({
    body: z.object({
      email: z.string().email(),
      password: z.string().refine(
        password => {
          return (
            password.length >= 8 &&
            UPPER_LETTER_REGEX.test(password) &&
            LOWER_LETTER_REGEX.test(password) &&
            DIGIT_REGEX.test(password) &&
            SPECIAL_CHAR_REGEX.test(password)
          );
        },
        {
          message:
            "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one digit and one special character"
        }
      ),
      termsAndConditions: z.boolean().refine(value => value, {
        message: "Please accept the terms and conditions"
      }),
      captchaToken: z.string()
    })
  }),
  async handler(ctx) {
    const { res, req, services, body } = ctx;

    const verification = await verifyCaptcha(body.captchaToken, ctx);
    if (verification.err) return res.status(400).json(verification.val);

    const result = await services.sessionService.signUp({
      email: req.body.email,
      password: req.body.password
    });

    if (result.ok) {
      await setSession(req, res, result.val);
      res.status(204).end();
      return;
    }

    const { cause, ...errorDetails } = result.val;
    services.logger.warn({
      event: "PASSWORD_SIGNUP_ERROR",
      code: errorDetails.code,
      message: errorDetails.message
    });

    if (result.val.code === "user_exists") {
      res.status(204).end();
      return;
    }

    return res.status(400).json(errorDetails);
  }
});
