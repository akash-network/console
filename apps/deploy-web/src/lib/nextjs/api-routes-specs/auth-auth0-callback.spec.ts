import type { LoggerService } from "@akashnetwork/logging";
import type { NextApiResponse } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type * as Auth0Module from "@src/lib/auth0";
import type { NextApiRequestWithServices } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import type { AppServices } from "@src/services/app-di-container/server-di-container.service";
import type { SessionService } from "@src/services/session/session.service";

vi.mock("@src/lib/auth0", async () => {
  const actual = await vi.importActual<typeof Auth0Module>("@src/lib/auth0");
  return {
    ...actual,
    handleAuth: vi.fn(
      (config: { callback: (req: NextApiRequestWithServices, res: NextApiResponse) => Promise<void> }) =>
        async (req: NextApiRequestWithServices, res: NextApiResponse) =>
          config.callback(req, res)
    ),
    handleCallback: vi.fn()
  };
});

describe("GET /api/auth/[...auth0] callback", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("forwards the referral cookie to createLocalUser", async () => {
    const { sessionService, session } = await callCallback({ cookies: { console_referral: "creator" } });

    expect(sessionService.createLocalUser).toHaveBeenCalledWith(session, { referralCode: "creator" });
  });

  it("omits the referral code when no cookie is present", async () => {
    const { sessionService, session } = await callCallback({ cookies: {} });

    expect(sessionService.createLocalUser).toHaveBeenCalledWith(session, { referralCode: undefined });
  });

  async function callCallback(input: { cookies: Partial<Record<string, string>> }) {
    vi.resetModules();

    const { REQ_SERVICES_KEY } = await import("@src/lib/nextjs/defineApiHandler/defineApiHandler");
    const authLib = await import("@src/lib/auth0");
    const session = Object.assign(new authLib.Session({ sub: "auth0|user-1", email: "user@example.com" }), { accessToken: "at" });
    const invokeAfterCallback = ((req: unknown, res: unknown, options: { afterCallback: (req: unknown, res: unknown, session: unknown) => Promise<unknown> }) =>
      options.afterCallback(req, res, session)) as typeof authLib.handleCallback;
    vi.mocked(authLib.handleCallback).mockImplementation(invokeAfterCallback);

    const sessionService = mock<SessionService>();
    sessionService.createLocalUser.mockResolvedValue({ userSettings: { username: "user", subscribedToNewsletter: false }, isNewUser: false });

    const requestServices = mock<AppServices>({
      sessionService,
      logger: mock<LoggerService>(),
      errorHandler: mock<AppServices["errorHandler"]>(),
      userTracker: mock<AppServices["userTracker"]>({ track: vi.fn() }),
      getSession: vi.fn().mockResolvedValue(null),
      privateConfig: { AUTH0_LOCAL_ENABLED: false } as AppServices["privateConfig"]
    });

    const req = mock<NextApiRequestWithServices>({
      method: "GET",
      [REQ_SERVICES_KEY]: requestServices
    });
    req.headers = {};
    req.query = { auth0: ["callback"] };
    req.cookies = input.cookies;

    const res = mock<NextApiResponse>({
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      writeHead: vi.fn().mockReturnThis()
    });

    const { default: handler } = await import("@src/pages/api/auth/[...auth0]");
    await handler(req, res);

    return { req, res, sessionService, session };
  }
});
