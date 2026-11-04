import type { HttpClient } from "@akashnetwork/http-sdk";
import { randomUUID } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { TURNSTILE_HTTP_CLIENT } from "@src/auth/providers/turnstile-http-client.provider";
import { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";

/** @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const CAPTCHA_VERIFICATION_FAILED_ERROR_CODE = "captcha_verification_failed";

export interface CaptchaVerificationContext {
  remoteIp?: string;
  testingClientToken?: string;
}

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

@singleton()
export class CaptchaVerifierService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    @inject(TURNSTILE_HTTP_CLIENT) private readonly httpClient: HttpClient,
    private readonly config: AuthConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: CaptchaVerifierService.name });
  }

  async verify(token: string | undefined, context: CaptchaVerificationContext): Promise<boolean> {
    if (!token) {
      const isTokenRequired = this.config.get("TURNSTILE_REQUIRED");

      if (isTokenRequired) {
        this.#logger.warn({ event: "CAPTCHA_VERIFICATION_FAILED", errorCodes: ["missing-input-response"] });
      }

      return !isTokenRequired;
    }

    if (!this.config.get("TURNSTILE_SECRET_KEY")) {
      return true;
    }

    const { data } = await this.httpClient.post<TurnstileVerifyResponse | null>(
      SITEVERIFY_URL,
      {
        secret: this.#getSecretKey(context.testingClientToken),
        response: token,
        remoteip: context.remoteIp,
        idempotency_key: randomUUID()
      },
      { validateStatus: status => status < 500 }
    );

    const isVerified = data?.success === true;

    if (!isVerified) {
      this.#logger.warn({ event: "CAPTCHA_VERIFICATION_FAILED", errorCodes: data?.["error-codes"] ?? [] });
    }

    return isVerified;
  }

  #getSecretKey(testingClientToken: string | undefined) {
    const expectedTestingClientToken = this.config.get("E2E_TESTING_CLIENT_TOKEN");

    if (expectedTestingClientToken && testingClientToken === expectedTestingClientToken) {
      return this.config.get("TURNSTILE_BYPASS_SECRET_KEY");
    }

    return this.config.get("TURNSTILE_SECRET_KEY");
  }
}
