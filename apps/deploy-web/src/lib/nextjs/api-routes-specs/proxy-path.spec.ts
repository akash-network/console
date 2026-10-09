import type { LoggerService } from "@akashnetwork/logging";
import type { NextApiResponse } from "next";
import type { Socket } from "node:net";
import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Session } from "@src/lib/auth0";
import type { NextApiRequestWithServices } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { REQ_SERVICES_KEY } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { proxyRequest as forwardRequest } from "@src/lib/nextjs/proxyRequest/proxyRequest";
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

  it("forwards the console_org cookie as x-organization-id", async () => {
    const { proxyRequest } = await setup({ session: null, headers: { cookie: "theme=dark; console_org=acme-corp" } });

    expect(getForwardedHeaders(proxyRequest)["x-organization-id"]).toBe("acme-corp");
  });

  it("sends no x-organization-id when there is no console_org cookie", async () => {
    const { proxyRequest } = await setup({ session: null, headers: { cookie: "theme=dark" } });

    expect(getForwardedHeaders(proxyRequest)["x-organization-id"]).toBeUndefined();
  });

  it("drops a console_org cookie whose value is not an organization id", async () => {
    const { proxyRequest } = await setup({ session: null, headers: { cookie: "console_org=Acme%20Corp" } });

    expect(getForwardedHeaders(proxyRequest)["x-organization-id"]).toBeUndefined();
  });

  it("never lets a client-supplied x-organization-id through", async () => {
    const { upstreamFetch } = await setup({ session: null, headers: { "x-organization-id": "other-org" } });

    expect(getUpstreamHeaders(upstreamFetch).has("x-organization-id")).toBe(false);
  });

  it("sends the console_org cookie value to the API instead of a client-supplied x-organization-id", async () => {
    const { upstreamFetch } = await setup({ session: null, headers: { cookie: "console_org=acme-corp", "x-organization-id": "other-org" } });

    expect(getUpstreamHeaders(upstreamFetch).get("x-organization-id")).toBe("acme-corp");
  });

  function getForwardedHeaders(proxyRequest: Mock): Record<string, string> {
    return proxyRequest.mock.calls[0]![2].headers as Record<string, string>;
  }

  function getUpstreamHeaders(upstreamFetch: Mock<typeof fetch>): Headers {
    return upstreamFetch.mock.calls[0]![1]!.headers as Headers;
  }

  async function setup(input: { session: Session | null; headers?: Record<string, string> }) {
    const upstreamFetch = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const proxyRequest = vi.fn<typeof services.proxyRequest>((req, res, options) => forwardRequest(req, res, { ...options, fetch: upstreamFetch }));
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
    req.headers = input.headers ?? {};
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

    return { proxyRequest, upstreamFetch, getSession, logger, req, res };
  }
});
