import type { LoggerService } from "@akashnetwork/logging";
import type { GetServerSidePropsContext } from "next";
import { Err, Ok } from "ts-results";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppTypedContext } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { TurnstileVerifierService } from "@src/services/turnstile-verifier/turnstile-verifier.service";
import { verifyCaptcha } from "./verify-captcha";

describe(verifyCaptcha.name, () => {
  it("returns Ok when turnstile is disabled", async () => {
    const { result } = await setup({
      turnstileEnabled: false,
      captchaToken: "test-token"
    });

    expect(result.ok).toBe(true);
  });

  it("returns Ok when captcha verification succeeds", async () => {
    const { result, captchaVerifier } = await setup({
      turnstileEnabled: true,
      captchaToken: "valid-token",
      verificationResult: Ok(undefined)
    });

    expect(result.ok).toBe(true);
    expect(captchaVerifier.verify).toHaveBeenCalledWith("valid-token", {
      remoteIp: "127.0.0.1",
      bypassVerificationToken: undefined
    });
  });

  it("returns Err when captcha verification fails", async () => {
    const { result, logger } = await setup({
      turnstileEnabled: true,
      captchaToken: "invalid-token",
      verificationResult: Err({
        code: "verification_failed" as const,
        errorCodes: ["invalid-input-response" as const]
      })
    });

    expect(result.err).toBe(true);
    if (result.err) {
      expect(result.val).toEqual({
        code: "captcha_verification_failed",
        message: "Captcha verification failed. Please try again."
      });
    }
    expect(logger.warn).toHaveBeenCalledWith({
      event: "CAPTCHA_VERIFICATION_FAILED",
      cause: {
        code: "verification_failed",
        errorCodes: ["invalid-input-response"]
      }
    });
  });

  it("passes bypass verification token from headers", async () => {
    const { captchaVerifier } = await setup({
      turnstileEnabled: true,
      captchaToken: "test-token",
      verificationResult: Ok(undefined),
      headers: {
        "x-testing-client-token": "bypass-token"
      }
    });

    expect(captchaVerifier.verify).toHaveBeenCalledWith("test-token", {
      remoteIp: "127.0.0.1",
      bypassVerificationToken: "bypass-token"
    });
  });

  describe("when extracting remote IP", () => {
    it("uses cf-connecting-ip header when available", async () => {
      const { captchaVerifier } = await setup({
        turnstileEnabled: true,
        captchaToken: "test-token",
        verificationResult: Ok(undefined),
        headers: {
          "cf-connecting-ip": "1.2.3.4",
          "x-real-ip": "5.6.7.8",
          "x-forwarded-for": "9.10.11.12"
        }
      });

      expect(captchaVerifier.verify).toHaveBeenCalledWith("test-token", {
        remoteIp: "1.2.3.4",
        bypassVerificationToken: undefined
      });
    });

    it("uses x-real-ip header when cf-connecting-ip is not available", async () => {
      const { captchaVerifier } = await setup({
        turnstileEnabled: true,
        captchaToken: "test-token",
        verificationResult: Ok(undefined),
        headers: {
          "x-real-ip": "5.6.7.8",
          "x-forwarded-for": "9.10.11.12"
        }
      });

      expect(captchaVerifier.verify).toHaveBeenCalledWith("test-token", {
        remoteIp: "5.6.7.8",
        bypassVerificationToken: undefined
      });
    });

    it("uses first IP from x-forwarded-for header when other headers are not available", async () => {
      const { captchaVerifier } = await setup({
        turnstileEnabled: true,
        captchaToken: "test-token",
        verificationResult: Ok(undefined),
        headers: {
          "x-forwarded-for": "9.10.11.12, 13.14.15.16"
        }
      });

      expect(captchaVerifier.verify).toHaveBeenCalledWith("test-token", {
        remoteIp: "9.10.11.12",
        bypassVerificationToken: undefined
      });
    });

    it("uses socket remoteAddress when no headers are available", async () => {
      const { captchaVerifier } = await setup({
        turnstileEnabled: true,
        captchaToken: "test-token",
        verificationResult: Ok(undefined),
        headers: {},
        socketRemoteAddress: "192.168.1.1"
      });

      expect(captchaVerifier.verify).toHaveBeenCalledWith("test-token", {
        remoteIp: "192.168.1.1",
        bypassVerificationToken: undefined
      });
    });
  });

  async function setup(input: {
    turnstileEnabled: boolean;
    captchaToken: string;
    verificationResult?: Awaited<ReturnType<TurnstileVerifierService["verify"]>>;
    headers?: Record<string, string>;
    socketRemoteAddress?: string;
  }) {
    const captchaVerifier = mock<TurnstileVerifierService>();
    const logger = mock<LoggerService>();

    captchaVerifier.verify.mockResolvedValue(input.verificationResult ?? Ok(undefined));

    const headers = input.headers ?? {
      "x-forwarded-for": "127.0.0.1"
    };
    const req = {
      headers,
      socket: {
        remoteAddress: input.socketRemoteAddress ?? "127.0.0.1"
      }
    } as GetServerSidePropsContext["req"];

    const context = {
      req,
      services: mock<AppTypedContext["services"]>({
        publicConfig: {
          NEXT_PUBLIC_TURNSTILE_ENABLED: input.turnstileEnabled
        } as AppTypedContext["services"]["publicConfig"],
        captchaVerifier,
        logger
      })
    };

    const result = await verifyCaptcha(input.captchaToken, context);

    return {
      result,
      captchaVerifier,
      logger,
      req
    };
  }
});
