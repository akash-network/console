import type { LoggerService } from "@akashnetwork/logging";
import type { NextApiRequest, NextApiResponse } from "next";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Session } from "@src/lib/auth0";
import type { NextApiRequestWithServices } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { REQ_SERVICES_KEY } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import type { ApiUrlService } from "@src/services/api-url/api-url.service";
import { services } from "@src/services/app-di-container/server-di-container.service";
import handler from "./[...path]";

describe("proxy [...path] handler", () => {
  it("forwards Bearer token when session has accessToken", async () => {
    const { proxyRequest } = await invokeHandler({
      session: { accessToken: "valid-token", user: { id: "u1" } } as Session
    });

    const headers = proxyRequest.mock.calls[0]![2].headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer valid-token");
  });

  it("does not forward Authorization header when session has no accessToken", async () => {
    const { proxyRequest } = await invokeHandler({
      session: { user: { id: "u1" } } as Session
    });

    const headers = proxyRequest.mock.calls[0]![2].headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it("does not forward Authorization header when there is no session at all", async () => {
    const { proxyRequest } = await invokeHandler({ session: null });

    const headers = proxyRequest.mock.calls[0]![2].headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it("forwards cf-connecting-ip and request-id headers", async () => {
    const { proxyRequest } = await invokeHandler({ session: null });

    const headers = proxyRequest.mock.calls[0]![2].headers as Record<string, string>;
    expect(headers["cf-connecting-ip"]).toBe("127.0.0.1");
  });

  async function invokeHandler(input: { session: Session | null }) {
    const proxyRequest = vi.fn().mockResolvedValue(undefined);
    const getSession = vi.fn().mockResolvedValue(input.session);
    const logger = mock<LoggerService>();

    const apiUrlService = mock<ApiUrlService>({
      getBaseApiUrlFor: vi.fn().mockReturnValue("http://api.test")
    });

    const req = {
      url: "/api/proxy/v1/tx",
      method: "POST",
      headers: {} as Record<string, string | string[] | undefined>,
      cookies: {},
      socket: { remoteAddress: "127.0.0.1" }
    } as unknown as NextApiRequest;
    const res = mock<NextApiResponse>();

    (req as NextApiRequestWithServices)[REQ_SERVICES_KEY] = {
      ...services,
      getSession,
      proxyRequest,
      logger,
      apiUrlService,
      privateConfig: { NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID: "mainnet" } as typeof services.privateConfig,
      userTracker: mock<typeof services.userTracker>()
    };

    await handler(req, res);

    return { proxyRequest, getSession, logger, req, res };
  }
});
