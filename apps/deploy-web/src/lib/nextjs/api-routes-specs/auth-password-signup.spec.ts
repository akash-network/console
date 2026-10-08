import type { LoggerService } from "@akashnetwork/logging";
import type { NextApiResponse } from "next";
import { Err, Ok } from "ts-results";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { Session } from "@src/lib/auth0";
import { BROWSER_TIMEZONE_COOKIE_NAME } from "@src/lib/browser-timezone/browser-timezone-cookie";
import type { NextApiRequestWithServices } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { REQ_SERVICES_KEY } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import handler from "@src/pages/api/auth/password-signup";
import type { AppServices } from "@src/services/app-di-container/server-di-container.service";
import type { SessionService } from "@src/services/session/session.service";

const VALID_BODY = { email: "user@example.com", password: "StrongPassword123!", termsAndConditions: true, captchaToken: "captcha-token" };

describe("POST /api/auth/password-signup", () => {
  it("signs up with the captcha token, the testing client token and the browser timezone, then sets the session", async () => {
    const session = new Session({ sub: "auth0|abc", email: "user@example.com" });
    const { res, sessionService, setSession } = await callHandler({
      body: VALID_BODY,
      signUpResult: Ok(session),
      headers: { "x-testing-client-token": "testing-client-token" },
      cookies: { [BROWSER_TIMEZONE_COOKIE_NAME]: "Europe/Paris" }
    });

    expect(sessionService.signUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "StrongPassword123!",
      captchaToken: "captcha-token",
      testingClientToken: "testing-client-token",
      timezone: "Europe/Paris"
    });
    expect(setSession).toHaveBeenCalledWith(expect.anything(), res, session);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("leaves captcha verification to the console api", async () => {
    const { captchaVerifier } = await callHandler({ body: VALID_BODY, signUpResult: Ok(new Session({ sub: "auth0|abc" })) });

    expect(captchaVerifier.verify).not.toHaveBeenCalled();
  });

  it("returns 400 and logs a captcha failure, not a signup error, when the console api refuses the captcha", async () => {
    const { res, logger } = await callHandler({
      body: VALID_BODY,
      signUpResult: Err({ code: "captcha_verification_failed", message: "Captcha verification failed. Please try again.", cause: { status: 400 } })
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ code: "captcha_verification_failed", message: "Captcha verification failed. Please try again." });
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "CAPTCHA_VERIFICATION_FAILED" }));
    expect(logger.warn).not.toHaveBeenCalledWith(expect.objectContaining({ event: "PASSWORD_SIGNUP_ERROR" }));
  });

  it("returns 400 and logs a signup error when the signup fails", async () => {
    const { res, logger } = await callHandler({
      body: VALID_BODY,
      signUpResult: Err({ code: "signup_failed", message: "Password is too weak", cause: { status: 400 } })
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ code: "signup_failed", message: "Password is too weak" });
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "PASSWORD_SIGNUP_ERROR" }));
  });

  it("forwards the referral cookie to signUp", async () => {
    const { sessionService } = await callHandler({
      body: VALID_BODY,
      signUpResult: Ok(new Session({ sub: "auth0|abc" })),
      cookies: { console_referral: "creator" }
    });

    expect(sessionService.signUp).toHaveBeenCalledWith(expect.objectContaining({ referralCode: "creator" }));
  });

  it("omits the referral code when no cookie is present", async () => {
    const { sessionService } = await callHandler({ body: VALID_BODY, signUpResult: Ok(new Session({ sub: "auth0|abc" })) });

    expect(sessionService.signUp).toHaveBeenCalledWith(expect.objectContaining({ referralCode: undefined }));
  });

  async function callHandler(input: {
    body: object;
    signUpResult: Awaited<ReturnType<SessionService["signUp"]>>;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  }) {
    const sessionService = mock<SessionService>();
    sessionService.signUp.mockResolvedValue(input.signUpResult);

    const logger = mock<LoggerService>();
    const setSession = vi.fn().mockResolvedValue(undefined);
    const captchaVerifier = mock<AppServices["captchaVerifier"]>({
      verify: vi.fn().mockResolvedValue(Ok(undefined))
    });
    const requestServices = mock<AppServices>({
      sessionService,
      logger,
      setSession,
      captchaVerifier,
      publicConfig: { NEXT_PUBLIC_TURNSTILE_ENABLED: true } as AppServices["publicConfig"],
      userTracker: mock<AppServices["userTracker"]>({ track: vi.fn() }),
      errorHandler: mock<AppServices["errorHandler"]>(),
      getSession: vi.fn().mockResolvedValue(null)
    });

    const req = mock<NextApiRequestWithServices>({
      method: "POST",
      body: input.body,
      [REQ_SERVICES_KEY]: requestServices
    });
    req.headers = input.headers ?? {};
    req.query = {};
    req.cookies = input.cookies ?? {};

    const res = mock<NextApiResponse>({
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis()
    });

    await handler(req, res);

    return { req, res, sessionService, setSession, logger, captchaVerifier };
  }
});
