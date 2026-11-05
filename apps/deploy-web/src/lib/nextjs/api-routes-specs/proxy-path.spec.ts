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

  it("forwards the host-bound organization cookie as x-organization-id", async () => {
    const { proxyRequest } = await setup({ session: null, headers: { cookie: "theme=dark; __Host-console_org=acme-corp" } });

    expect(getForwardedHeaders(proxyRequest)["x-organization-id"]).toBe("acme-corp");
  });

  it("forwards the console_org cookie of a console served over plain http", async () => {
    const { proxyRequest } = await setup({ session: null, headers: { cookie: "console_org=acme-corp" }, consoleUrl: "http://localhost:3000" });

    expect(getForwardedHeaders(proxyRequest)["x-organization-id"]).toBe("acme-corp");
  });

  it("ignores an unprefixed console_org cookie on a console served over https", async () => {
    const { proxyRequest } = await setup({ session: null, headers: { cookie: "console_org=acme-corp" } });

    expect(getForwardedHeaders(proxyRequest)["x-organization-id"]).toBeUndefined();
  });

  it("sends no x-organization-id when there is no organization cookie", async () => {
    const { proxyRequest } = await setup({ session: null, headers: { cookie: "theme=dark" } });

    expect(getForwardedHeaders(proxyRequest)["x-organization-id"]).toBeUndefined();
  });

  it("drops an organization cookie whose value is not an organization id", async () => {
    const { proxyRequest } = await setup({ session: null, headers: { cookie: "__Host-console_org=Acme%20Corp" } });

    expect(getForwardedHeaders(proxyRequest)["x-organization-id"]).toBeUndefined();
  });

  it("treats an organization cookie sent twice as no organization and expires it", async () => {
    const { proxyRequest, res, logger } = await setup({
      session: null,
      headers: { cookie: "__Host-console_org=globex; __Host-console_org=acme-corp" }
    });

    expect(getForwardedHeaders(proxyRequest)["x-organization-id"]).toBeUndefined();
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", ["__Host-console_org=; Path=/; Max-Age=0; SameSite=Lax; Secure"]);
    expect(logger.warn).toHaveBeenCalledWith({ event: "DUPLICATE_ACTIVE_ORGANIZATION_COOKIE_REFUSED" });
  });

  it("leaves an organization cookie sent once in place", async () => {
    const { res } = await setup({ session: null, headers: { cookie: "__Host-console_org=acme-corp" } });

    expect(res.setHeader).not.toHaveBeenCalledWith("Set-Cookie", expect.anything());
  });

  it("sends the organization the tab names instead of the one the organization cookie holds", async () => {
    const { upstreamFetch } = await setup({ session: null, headers: { cookie: "__Host-console_org=acme-corp", "x-organization-id": "globex" } });

    expect(getUpstreamHeaders(upstreamFetch).get("x-organization-id")).toBe("globex");
  });

  it("sends the organization the tab names when there is no organization cookie", async () => {
    const { upstreamFetch } = await setup({ session: null, headers: { "x-organization-id": "globex" } });

    expect(getUpstreamHeaders(upstreamFetch).get("x-organization-id")).toBe("globex");
  });

  it("falls back to the organization cookie when the tab names something that is not an organization id", async () => {
    const { upstreamFetch } = await setup({ session: null, headers: { cookie: "__Host-console_org=acme-corp", "x-organization-id": "Globex Inc" } });

    expect(getUpstreamHeaders(upstreamFetch).get("x-organization-id")).toBe("acme-corp");
  });

  it("never passes on a named organization that is not an organization id", async () => {
    const { upstreamFetch } = await setup({ session: null, headers: { "x-organization-id": "Globex Inc" } });

    expect(getUpstreamHeaders(upstreamFetch).has("x-organization-id")).toBe(false);
  });

  it("refuses a write another site sends without calling the API", async () => {
    const { proxyRequest, upstreamFetch, res } = await setup({
      session: { accessToken: "valid-token", user: { id: "u1" } } as Session,
      headers: { "sec-fetch-site": "same-site", origin: "https://stats.akash.network" }
    });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(proxyRequest).not.toHaveBeenCalled();
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("gives an assistant turn longer than the default timeout to stream", async () => {
    const { proxyRequest } = await setup({ session: null, requestUrl: "/api/proxy/v1/assistant/conversations/c-1/messages" });

    expect(proxyRequest.mock.calls[0]![2].timeout).toBe(150_000);
  });

  it("keeps the default timeout for assistant calls that do not stream", async () => {
    const { proxyRequest } = await setup({ session: null, requestUrl: "/api/proxy/v1/assistant/conversations/c-1/end" });

    expect(proxyRequest.mock.calls[0]![2].timeout).toBeUndefined();
  });

  it("gives the browser tool results the same streaming timeout", async () => {
    const { proxyRequest } = await setup({ session: null, requestUrl: "/api/proxy/v1/assistant/conversations/c-1/client-tool-results" });

    expect(proxyRequest.mock.calls[0]![2].timeout).toBe(150_000);
  });

  function getForwardedHeaders(proxyRequest: Mock): Record<string, string> {
    return proxyRequest.mock.calls[0]![2].headers as Record<string, string>;
  }

  function getUpstreamHeaders(upstreamFetch: Mock<typeof fetch>): Headers {
    return upstreamFetch.mock.calls[0]![1]!.headers as Headers;
  }

  async function setup(input: { session: Session | null; headers?: Record<string, string>; consoleUrl?: string; requestUrl?: string }) {
    const upstreamFetch = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const proxyRequest = vi.fn<typeof services.proxyRequest>((req, res, options) => forwardRequest(req, res, { ...options, fetch: upstreamFetch }));
    const getSession = vi.fn().mockResolvedValue(input.session);
    const logger = mock<LoggerService>();

    const apiUrlService = mock<ApiUrlService>({
      getBaseApiUrlFor: vi.fn().mockReturnValue("http://api.test")
    });

    const req = mock<NextApiRequestWithServices>({
      url: input.requestUrl ?? "/api/proxy/v1/tx",
      method: "POST",
      cookies: {},
      socket: mock<Socket>({ remoteAddress: "127.0.0.1" })
    });
    req.headers = input.headers ?? {};
    const res = mock<NextApiResponse>({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

    req[REQ_SERVICES_KEY] = {
      ...services,
      getSession,
      proxyRequest,
      logger,
      apiUrlService,
      privateConfig: {
        NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID: "mainnet",
        AUTH0_BASE_URL: input.consoleUrl ?? "https://console.test"
      } as typeof services.privateConfig,
      userTracker: mock<typeof services.userTracker>()
    };

    await handler(req, res);

    return { proxyRequest, upstreamFetch, getSession, logger, req, res };
  }
});
