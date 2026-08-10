import type { LoggerService } from "@akashnetwork/logging";
import type { NextApiResponse } from "next";
import { Err, Ok } from "ts-results";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ACCOUNT_CREATED_COOKIE } from "@src/lib/analytics/account-created-cookie";
import { Session } from "@src/lib/auth0";
import type { NextApiRequestWithServices } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { REQ_SERVICES_KEY } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import handler from "@src/pages/api/auth/email-code-verify";
import type { AppServices } from "@src/services/app-di-container/server-di-container.service";
import type { SessionService } from "@src/services/session/session.service";

describe("POST /api/auth/email-code-verify", () => {
  it("returns 204 after register-user + setSession on success", async () => {
    const session = Object.assign(new Session({ sub: "auth0|email|abc", email: "user@example.com" }), { accessToken: "at" });
    const { res, sessionService, setSession } = await callHandler({
      body: { email: "user@example.com", code: "123456", captchaToken: "tok" },
      verifyResult: Ok(session)
    });

    expect(sessionService.verifyEmailCode).toHaveBeenCalledWith({ email: "user@example.com", code: "123456" });
    expect(sessionService.createLocalUser).toHaveBeenCalledWith(session);
    expect(setSession).toHaveBeenCalled();
    expect(sessionService.createLocalUser.mock.invocationCallOrder[0]).toBeLessThan(setSession.mock.invocationCallOrder[0]);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("merges the local user settings into the session before persisting it", async () => {
    const session = Object.assign(new Session({ sub: "auth0|email|abc", email: "user@example.com" }), { accessToken: "at" });
    const { setSession } = await callHandler({
      body: { email: "user@example.com", code: "123456", captchaToken: "tok" },
      verifyResult: Ok(session),
      userSettings: { userId: "user-123", username: "alice", subscribedToNewsletter: true }
    });

    expect(setSession.mock.calls[0][2].user).toEqual(expect.objectContaining({ userId: "user-123", username: "alice", subscribedToNewsletter: true }));
  });

  it("sets the account-created cookie when the user is newly created", async () => {
    const session = Object.assign(new Session({ sub: "auth0|email|abc", email: "user@example.com" }), { accessToken: "at" });
    const { res } = await callHandler({
      body: { email: "user@example.com", code: "123456", captchaToken: "tok" },
      verifyResult: Ok(session),
      isNewUser: true
    });

    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", [expect.stringContaining(`${ACCOUNT_CREATED_COOKIE}=1`)]);
  });

  it("does not set the account-created cookie for an existing user", async () => {
    const session = Object.assign(new Session({ sub: "auth0|email|abc", email: "user@example.com" }), { accessToken: "at" });
    const { res } = await callHandler({
      body: { email: "user@example.com", code: "123456", captchaToken: "tok" },
      verifyResult: Ok(session),
      isNewUser: false
    });

    expect(res.setHeader).not.toHaveBeenCalledWith("Set-Cookie", expect.anything());
  });

  it("does not set the session if createLocalUser throws", async () => {
    const session = Object.assign(new Session({ sub: "auth0|email|abc", email: "user@example.com" }), { accessToken: "at" });
    const { res, setSession } = await callHandler({
      body: { email: "user@example.com", code: "123456", captchaToken: "tok" },
      verifyResult: Ok(session),
      createLocalUserError: new Error("downstream failure"),
      expectThrow: true
    });

    expect(setSession).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(204);
  });

  it("returns 429 with Retry-After when rate_limited", async () => {
    const { res } = await callHandler({
      body: { email: "user@example.com", code: "000000", captchaToken: "tok" },
      verifyResult: Err({ code: "rate_limited", message: "Slow down", retryAfter: 30, cause: {} })
    });

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "30");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "rate_limited", retryAfter: 30 }));
  });

  it("returns 400 with translated code on invalid_code", async () => {
    const { res, setSession } = await callHandler({
      body: { email: "user@example.com", code: "000000", captchaToken: "tok" },
      verifyResult: Err({ code: "invalid_code", message: "Wrong code", cause: {} })
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "invalid_code" }));
    expect(setSession).not.toHaveBeenCalled();
  });

  it("strips the cause from the error response", async () => {
    const { res } = await callHandler({
      body: { email: "user@example.com", code: "000000", captchaToken: "tok" },
      verifyResult: Err({ code: "invalid_code", message: "Wrong code", cause: { internal: "secret" } })
    });

    expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({ cause: expect.anything() }));
  });

  async function callHandler(input: {
    body: object;
    verifyResult?: Awaited<ReturnType<SessionService["verifyEmailCode"]>>;
    createLocalUserError?: Error;
    isNewUser?: boolean;
    userSettings?: Awaited<ReturnType<SessionService["createLocalUser"]>>["userSettings"];
    expectThrow?: boolean;
  }) {
    const sessionService = mock<SessionService>();
    if (input.verifyResult) {
      sessionService.verifyEmailCode.mockResolvedValue(input.verifyResult);
    }
    if (input.createLocalUserError) {
      sessionService.createLocalUser.mockRejectedValue(input.createLocalUserError);
    } else {
      sessionService.createLocalUser.mockResolvedValue({
        userSettings: input.userSettings ?? { username: "user", subscribedToNewsletter: false },
        isNewUser: input.isNewUser ?? false
      });
    }

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

    const res = mock<NextApiResponse>({
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis()
    });

    if (input.expectThrow) {
      await expect(handler(req, res)).rejects.toThrow();
    } else {
      await handler(req, res);
    }

    return { req, res, sessionService, setSession };
  }
});
