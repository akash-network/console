import type { LoggerService } from "@akashnetwork/logging";
import type { NextApiResponse } from "next";
import { Err, Ok } from "ts-results";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { Session } from "@src/lib/auth0";
import type { NextApiRequestWithServices } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { REQ_SERVICES_KEY } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import handler from "@src/pages/api/auth/password-signup";
import type { AppServices } from "@src/services/app-di-container/server-di-container.service";
import type { SessionService } from "@src/services/session/session.service";

describe("POST /api/auth/password-signup", () => {
  it("sets the session and returns 204 on success", async () => {
    const session = Object.assign(new Session({ sub: "auth0|password|abc", email: "user@example.com" }), { accessToken: "at" });
    const { res, setSession } = await callHandler({
      body: { email: "user@example.com", password: "StrongPassword123!", termsAndConditions: true, captchaToken: "tok" },
      signUpResult: Ok(session)
    });

    expect(setSession).toHaveBeenCalledWith(expect.anything(), expect.anything(), session);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("returns 204 without a session when the user already exists", async () => {
    const { res, setSession } = await callHandler({
      body: { email: "user@example.com", password: "StrongPassword123!", termsAndConditions: true, captchaToken: "tok" },
      signUpResult: Err({ code: "user_exists", message: "Such user already exists but credentials are invalid", cause: {} })
    });

    expect(setSession).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("returns 400 with the error details when signup fails", async () => {
    const { res, setSession } = await callHandler({
      body: { email: "user@example.com", password: "StrongPassword123!", termsAndConditions: true, captchaToken: "tok" },
      signUpResult: Err({ code: "signup_failed", message: "Password is too weak", cause: { internal: "secret" } })
    });

    expect(setSession).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "signup_failed", message: "Password is too weak" }));
    expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({ cause: expect.anything() }));
  });

  it("forwards the referral cookie to signUp", async () => {
    const session = Object.assign(new Session({ sub: "auth0|password|abc", email: "user@example.com" }), { accessToken: "at" });
    const { sessionService } = await callHandler({
      body: { email: "user@example.com", password: "StrongPassword123!", termsAndConditions: true, captchaToken: "tok" },
      signUpResult: Ok(session),
      cookies: { console_referral: "creator" }
    });

    expect(sessionService.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@example.com", password: "StrongPassword123!", referralCode: "creator" })
    );
  });

  it("omits the referral code when no cookie is present", async () => {
    const session = Object.assign(new Session({ sub: "auth0|password|abc", email: "user@example.com" }), { accessToken: "at" });
    const { sessionService } = await callHandler({
      body: { email: "user@example.com", password: "StrongPassword123!", termsAndConditions: true, captchaToken: "tok" },
      signUpResult: Ok(session)
    });

    expect(sessionService.signUp).toHaveBeenCalledWith(expect.objectContaining({ referralCode: undefined }));
  });

  async function callHandler(input: { body: object; signUpResult: Awaited<ReturnType<SessionService["signUp"]>>; cookies?: Partial<Record<string, string>> }) {
    const sessionService = mock<SessionService>();
    sessionService.signUp.mockResolvedValue(input.signUpResult);

    const logger = mock<LoggerService>();
    const setSession = vi.fn().mockResolvedValue(undefined);
    const requestServices = mock<AppServices>({
      sessionService,
      logger,
      setSession,
      captchaVerifier: mock<AppServices["captchaVerifier"]>({
        verify: vi.fn().mockResolvedValue(Ok(undefined))
      }),
      publicConfig: { NEXT_PUBLIC_TURNSTILE_ENABLED: false } as AppServices["publicConfig"],
      userTracker: mock<AppServices["userTracker"]>({ track: vi.fn() }),
      errorHandler: mock<AppServices["errorHandler"]>(),
      getSession: vi.fn().mockResolvedValue(null)
    });

    const req = mock<NextApiRequestWithServices>({
      method: "POST",
      body: input.body,
      [REQ_SERVICES_KEY]: requestServices
    });
    req.headers = {};
    req.query = {};
    req.cookies = input.cookies ?? {};

    const res = mock<NextApiResponse>({
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis()
    });

    await handler(req, res);

    return { req, res, sessionService, setSession };
  }
});
