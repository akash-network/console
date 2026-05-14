import type { LoggerService } from "@akashnetwork/logging";
import type { NextApiResponse } from "next";
import { Err, Ok } from "ts-results";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { NextApiRequestWithServices } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { REQ_SERVICES_KEY } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import type { AppServices } from "@src/services/app-di-container/server-di-container.service";
import type { SessionService } from "@src/services/session/session.service";
import handler from "./email-code-start";

describe("POST /api/auth/email-code-start", () => {
  it("returns 204 on successful start", async () => {
    const { res, sessionService } = await callHandler({
      body: { email: "user@example.com", captchaToken: "tok" }
    });

    expect(sessionService.startEmailCode).toHaveBeenCalledWith({ email: "user@example.com" });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("returns 400 with code when service errors", async () => {
    const { res } = await callHandler({
      body: { email: "user@example.com", captchaToken: "tok" },
      startResult: Err({ code: "invalid_email", message: "Invalid email", cause: {} })
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "invalid_email" }));
  });

  it("returns 429 with Retry-After when rate_limited", async () => {
    const { res } = await callHandler({
      body: { email: "user@example.com", captchaToken: "tok" },
      startResult: Err({ code: "rate_limited", message: "Slow down", retryAfter: 30, cause: {} })
    });

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "30");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "rate_limited", retryAfter: 30 }));
  });

  it("strips the cause from the error response", async () => {
    const { res } = await callHandler({
      body: { email: "user@example.com", captchaToken: "tok" },
      startResult: Err({ code: "invalid_email", message: "Invalid email", cause: { secret: "internal" } })
    });

    expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({ cause: expect.anything() }));
  });

  it("rejects malformed email at the schema layer", async () => {
    const { res, sessionService } = await callHandler({
      body: { email: "not-an-email", captchaToken: "tok" }
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(sessionService.startEmailCode).not.toHaveBeenCalled();
  });

  async function callHandler(input: { body: object; startResult?: Awaited<ReturnType<SessionService["startEmailCode"]>> }) {
    const sessionService = mock<SessionService>();
    sessionService.startEmailCode.mockResolvedValue(input.startResult ?? Ok(undefined));

    const logger = mock<LoggerService>();
    const requestServices = mock<AppServices>({
      sessionService,
      logger,
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

    await handler(req, res);

    return { req, res, sessionService };
  }
});
