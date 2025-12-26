import type { IncomingMessage } from "http";
import { Err, Ok } from "ts-results";

import type { AppTypedContext } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export async function verifyCaptcha(captchaToken: string, { services, req }: Pick<AppTypedContext, "services" | "req">) {
  const remoteIp = getRemoteIp(req);
  const captchaVerification = await services.captchaVerifier.verify(captchaToken, {
    remoteIp,
    bypassVerificationToken: req.headers["x-testing-client-token"] as string | undefined
  });
  if (captchaVerification.err) {
    services.logger.warn({
      event: "CAPTCHA_VERIFICATION_FAILED",
      cause: captchaVerification.val
    });

    return Err({
      code: "captcha_verification_failed",
      message: "Captcha verification failed. Please try again."
    });
  }

  return Ok(undefined);
}

function getRemoteIp(req: IncomingMessage) {
  if (req.headers["cf-connecting-ip"]) return req.headers["cf-connecting-ip"] as string;
  if (req.headers["x-real-ip"]) return req.headers["x-real-ip"] as string;
  if (typeof req.headers["x-forwarded-for"] === "string") return req.headers["x-forwarded-for"].split(",")[0]?.trim();
  return req.socket?.remoteAddress;
}
