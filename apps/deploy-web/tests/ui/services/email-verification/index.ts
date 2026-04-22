import { testEnvConfig } from "../../fixture/test-env.config";
import type { Auth0ManagementService } from "../auth0-management.service";
import { Auth0TicketVerificationStrategy } from "./auth0-ticket.strategy";
import type { EmailVerificationStrategy } from "./email-verification.strategy";
import { MailsacCodeVerificationStrategy } from "./mailsac-code.strategy";

export type { EmailVerificationStrategy } from "./email-verification.strategy";

export function createEmailVerificationStrategy(auth0: Auth0ManagementService): EmailVerificationStrategy {
  if (testEnvConfig.EMAIL_VERIFICATION_STRATEGY === "auth0-ticket") {
    return new Auth0TicketVerificationStrategy(auth0);
  }

  return new MailsacCodeVerificationStrategy(testEnvConfig.MAILSAC_API_KEY);
}
