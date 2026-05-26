import type { LoggerService } from "@akashnetwork/logging";
import type { NextApiResponse } from "next";
import type { Socket } from "node:net";
import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Session } from "@src/lib/auth0";
import type { NextApiRequestWithServices } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { REQ_SERVICES_KEY } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import handler from "@src/pages/api/proxy/[...path]";
import type { ApiUrlService } from "@src/services/api-url/api-url.service";
import { services } from "@src/services/app-di-container/server-di-container.service";

describe("proxy [...path] handler", () => {
  it("forwards Bearer token when session has accessToken", async () => {
    const { proxyRequest } = await setup({
      session: { accessToken: "valid-token", user: { id: "u1" } } as Session
    });

    expect(getForwardedHeaders(proxyRequest).authorization).toBe("Bearer valid-token");
  });

  it("does not forward Authorization header when session has no accessToken", async () => {
    const { proxyRequest } = await setup({
      session: { user: { id: "u1" } } as Session
    });

    expect(getForwardedHeaders(proxyRequest).authorization).toBeUndefined();
  });

  it("does not forward Authorization header when there is no session at all", async () => {
    const { proxyRequest } = await setup({ session: null });

    expect(getForwardedHeaders(proxyRequest).authorization).toBeUndefined();
  });

  it("forwards cf-connecting-ip header", async () => {
    const { proxyRequest } = await setup({ session: null });

    expect(getForwardedHeaders(proxyRequest)["cf-connecting-ip"]).toBe("127.0.0.1");
  });

  function getForwardedHeaders(proxyRequest: Mock): Record<string, string> {
    return proxyRequest.mock.calls[0]![2].headers as Record<string, string>;
  }

  async function setup(input: { session: Session | null }) {
    const proxyRequest = vi.fn().mockResolvedValue(undefined);
    const getSession = vi.fn().mockResolvedValue(input.session);
    const logger = mock<LoggerService>();

    const apiUrlService = mock<ApiUrlService>({
      getBaseApiUrlFor: vi.fn().mockReturnValue("http://api.test")
    });

    const req = mock<NextApiRequestWithServices>({
      url: "/api/proxy/v1/tx",
      method: "POST",
      cookies: {},
      socket: mock<Socket>({ remoteAddress: "127.0.0.1" })
    });
    req.headers = {};
    const res = mock<NextApiResponse>();

    req[REQ_SERVICES_KEY] = {
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
