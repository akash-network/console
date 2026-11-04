import type { HttpClient } from "@akashnetwork/http-sdk";
import type { AxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { CaptchaVerifierService } from "./captcha-verifier.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

describe(CaptchaVerifierService.name, () => {
  describe("verify", () => {
    it("accepts a missing token without contacting turnstile when a token is not required", async () => {
      const { service, httpClient, logger } = setup({ config: { TURNSTILE_REQUIRED: false } });

      await expect(service.verify(undefined, {})).resolves.toBe(true);
      expect(httpClient.post).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("verifies a token with turnstile even when a token is not required", async () => {
      const { service, httpClient } = setup({ response: { success: false }, config: { TURNSTILE_REQUIRED: false } });

      await expect(service.verify("captcha-token", {})).resolves.toBe(false);
      expect(httpClient.post).toHaveBeenCalledWith(
        SITEVERIFY_URL,
        expect.objectContaining({ secret: "turnstile-secret-key", response: "captcha-token" }),
        expect.anything()
      );
    });

    it("accepts a token without contacting turnstile when no secret key is configured", async () => {
      const { service, httpClient } = setup({ config: { TURNSTILE_REQUIRED: false, TURNSTILE_SECRET_KEY: undefined } });

      await expect(service.verify("captcha-token", {})).resolves.toBe(true);
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it("rejects an empty token without contacting turnstile when a token is required", async () => {
      const { service, httpClient } = setup();

      await expect(service.verify("", {})).resolves.toBe(false);
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it("rejects a missing token without contacting turnstile when a token is required", async () => {
      const { service, httpClient, logger } = setup();

      await expect(service.verify(undefined, { remoteIp: "203.0.113.7" })).resolves.toBe(false);
      expect(httpClient.post).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "CAPTCHA_VERIFICATION_FAILED", errorCodes: ["missing-input-response"] });
    });

    it("accepts a token turnstile confirms, sending the secret key, the caller's ip and an idempotency key", async () => {
      const { service, httpClient, logger } = setup({ response: { success: true } });

      await expect(service.verify("captcha-token", { remoteIp: "203.0.113.7" })).resolves.toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        SITEVERIFY_URL,
        {
          secret: "turnstile-secret-key",
          response: "captcha-token",
          remoteip: "203.0.113.7",
          idempotency_key: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
        },
        expect.anything()
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("sends a new idempotency key for every token", async () => {
      const { service, httpClient } = setup({ response: { success: true } });

      await service.verify("first-token", {});
      await service.verify("second-token", {});

      const [firstIdempotencyKey, secondIdempotencyKey] = httpClient.post.mock.calls.map(([, body]) => (body as { idempotency_key: string }).idempotency_key);
      expect(firstIdempotencyKey).not.toEqual(secondIdempotencyKey);
    });

    it("reads turnstile's rejections from the body and leaves its outages to throw", async () => {
      const { service, httpClient } = setup({ response: { success: true } });

      await service.verify("captcha-token", {});

      const { validateStatus } = httpClient.post.mock.calls[0][2] as AxiosRequestConfig;
      expect(validateStatus?.(499)).toBe(true);
      expect(validateStatus?.(500)).toBe(false);
    });

    it("rejects a token turnstile refuses and logs its error codes", async () => {
      const { service, logger } = setup({ response: { success: false, "error-codes": ["timeout-or-duplicate"] } });

      await expect(service.verify("captcha-token", {})).resolves.toBe(false);
      expect(logger.warn).toHaveBeenCalledWith({ event: "CAPTCHA_VERIFICATION_FAILED", errorCodes: ["timeout-or-duplicate"] });
    });

    it("logs an empty error code list when turnstile refuses a token without codes", async () => {
      const { service, logger } = setup({ response: { success: false } });

      await expect(service.verify("captcha-token", {})).resolves.toBe(false);
      expect(logger.warn).toHaveBeenCalledWith({ event: "CAPTCHA_VERIFICATION_FAILED", errorCodes: [] });
    });

    it("rejects a token and logs no error codes when turnstile answers without a body", async () => {
      const { service, httpClient, logger } = setup();
      httpClient.post.mockResolvedValue({ data: null });

      await expect(service.verify("captcha-token", {})).resolves.toBe(false);
      expect(logger.warn).toHaveBeenCalledWith({ event: "CAPTCHA_VERIFICATION_FAILED", errorCodes: [] });
    });

    it("verifies with the testing secret key when the request carries the testing client token", async () => {
      const { service, httpClient } = setup({ response: { success: true }, config: { E2E_TESTING_CLIENT_TOKEN: "testing-client-token" } });

      await service.verify("captcha-token", { testingClientToken: "testing-client-token" });

      expect(httpClient.post).toHaveBeenCalledWith(SITEVERIFY_URL, expect.objectContaining({ secret: "turnstile-testing-secret-key" }), expect.anything());
    });

    it("verifies with the secret key when the testing client token does not match", async () => {
      const { service, httpClient } = setup({ response: { success: true }, config: { E2E_TESTING_CLIENT_TOKEN: "testing-client-token" } });

      await service.verify("captcha-token", { testingClientToken: "another-token" });

      expect(httpClient.post).toHaveBeenCalledWith(SITEVERIFY_URL, expect.objectContaining({ secret: "turnstile-secret-key" }), expect.anything());
    });

    it("verifies with the secret key when no testing client token is configured", async () => {
      const { service, httpClient } = setup({ response: { success: true }, config: { E2E_TESTING_CLIENT_TOKEN: undefined } });

      await service.verify("captcha-token", { testingClientToken: undefined });

      expect(httpClient.post).toHaveBeenCalledWith(SITEVERIFY_URL, expect.objectContaining({ secret: "turnstile-secret-key" }), expect.anything());
    });
  });

  it("logs under its own context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: CaptchaVerifierService.name });
  });

  function setup(
    input: {
      response?: { success: boolean; "error-codes"?: string[] };
      config?: { TURNSTILE_REQUIRED?: boolean; TURNSTILE_SECRET_KEY?: string; E2E_TESTING_CLIENT_TOKEN?: string };
    } = {}
  ) {
    const httpClient = mock<HttpClient>();
    httpClient.post.mockResolvedValue({ data: input.response ?? { success: false } });
    const config = mockConfigService<AuthConfigService>({
      TURNSTILE_REQUIRED: true,
      TURNSTILE_SECRET_KEY: "turnstile-secret-key",
      TURNSTILE_BYPASS_SECRET_KEY: "turnstile-testing-secret-key",
      E2E_TESTING_CLIENT_TOKEN: undefined,
      ...input.config
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new CaptchaVerifierService(httpClient, config, createLogger);

    return { service, httpClient, config, logger, createLogger };
  }
});
