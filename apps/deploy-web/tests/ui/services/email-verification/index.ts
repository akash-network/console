import { testEnvConfig } from "../../fixture/test-env.config";
import type { EmailVerificationStrategy } from "./email-verification.strategy";
import { MailsacCodeVerificationStrategy } from "./mailsac-code.strategy";

export type { EmailVerificationStrategy } from "./email-verification.strategy";

/**
 * The onboarding user verifies email through the real Mailsac inbox (OTP code), matching the passwordless
 * signup flow. The prior `auth0-ticket` bypass has been removed so the onboarding journey always exercises
 * real email delivery end-to-end.
 */
export function createEmailVerificationStrategy(): EmailVerificationStrategy {
  return new MailsacCodeVerificationStrategy(testEnvConfig.MAILSAC_API_KEY);
}
