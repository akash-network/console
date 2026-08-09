import { testEnvConfig } from "../../fixture/test-env.config";
import type { EmailVerificationStrategy } from "./email-verification.strategy";
import { InboxCodeVerificationStrategy } from "./inbox-code.strategy";
import { WorkerInboxClient } from "./worker-inbox.client";

export type { EmailVerificationStrategy } from "./email-verification.strategy";

/**
 * Email verification reads real Auth0 OTP emails through the self-hosted inbox worker
 * (tools/e2e-inbox-worker), so signup and passwordless flows exercise real email delivery
 * end-to-end without depending on a third-party inbox service and its quotas.
 */
export function createEmailVerificationStrategy(): EmailVerificationStrategy {
  return new InboxCodeVerificationStrategy(
    new WorkerInboxClient({
      apiUrl: testEnvConfig.E2E_INBOX_API_URL,
      apiToken: testEnvConfig.E2E_INBOX_API_TOKEN,
      emailDomain: testEnvConfig.E2E_INBOX_EMAIL_DOMAIN
    })
  );
}
