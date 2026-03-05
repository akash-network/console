import type { HttpClient } from "@akashnetwork/http-sdk";
import type { Result } from "ts-results";
import { Err, Ok } from "ts-results";

export class TurnstileVerifierService {
  readonly #config: TurnstileVerifierConfig;
  /**
   * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
   */
  readonly #verificationUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
  readonly #externalApiHttpClient: HttpClient;

  constructor(externalApiHttpClient: HttpClient, config: TurnstileVerifierConfig) {
    this.#externalApiHttpClient = externalApiHttpClient;
    this.#config = config;
  }

  async verify(
    token: string,
    options?: {
      remoteIp?: string;
      bypassVerificationToken?: string;
    }
  ): Promise<
    Result<
      void,
      {
        code: "verification_failed";
        errorCodes: Required<TurnstileVerifyResponse>["error-codes"];
      }
    >
  > {
    const canUseBypassSecretKey =
      this.#config.bypassSecretKeyVerificationToken && options?.bypassVerificationToken === this.#config.bypassSecretKeyVerificationToken;
    const payload: Record<string, string> = {
      secret: canUseBypassSecretKey ? this.#config.turnstileBypassSecretKey : this.#config.secretKey,
      response: token
    };
    if (options?.remoteIp) {
      payload.remoteip = options.remoteIp;
    }

    const { data } = await this.#externalApiHttpClient.post<TurnstileVerifyResponse>(this.#verificationUrl, payload, {
      headers: {
        "Content-Type": "application/json"
      },
      validateStatus: status => status < 500
    });

    if (data.success) return Ok(undefined);

    return Err({
      code: "verification_failed",
      errorCodes: data["error-codes"] || []
    });
  }
}

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: Array<
    | "missing-input-secret"
    | "invalid-input-secret"
    | "missing-input-response"
    | "invalid-input-response"
    | "bad-request"
    | "timeout-or-duplicate"
    | "internal-error"
  >;
  challenge_ts?: string;
  hostname?: string;
}

interface TurnstileVerifierConfig {
  secretKey: string;
  /**
   * @see https://developers.cloudflare.com/turnstile/troubleshooting/testing/#test-secret-keys
   */
  turnstileBypassSecretKey: string;
  /**
   * Token used to enable bypassing Turnstile's secret key verification
   */
  bypassSecretKeyVerificationToken: string;
}
