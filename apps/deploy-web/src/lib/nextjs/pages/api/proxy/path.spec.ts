import { mock } from "jest-mock-extended";
import type { NextApiRequest, NextApiResponse } from "next";

import type { NextApiRequestWithServices } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { REQ_SERVICES_KEY } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import proxyHandler from "@src/pages/api/proxy/[...path]";
import { services } from "@src/services/app-di-container/server-di-container.service";

describe("proxy API handler", () => {
  it("forwards cf_clearance and unleash-session-id cookies to backend", async () => {
    const { req, handlerPromise } = setup({
      url: "/api/proxy/v1/wallets?userId=2d888ad9-9359-4699-938f-3d66a8a8881a",
      headers: {
        cookie: "cf_clearance=test123; other-cookie=ignored; unleash-session-id=session456; another-cookie=also-ignored"
      }
    });

    await handlerPromise;

    expect(req.headers.cookie).toBe("cf_clearance=test123; unleash-session-id=session456");
  });

  function setup(input: {
    url: string;
    headers?: Record<string, string>;
    socket?: { remoteAddress: string };
    session?: { accessToken?: string; user: object };
  }) {
    const mockLogger = mock<typeof services.logger>();
    const mockGetSession = jest.fn();
    const mockUserTracker = mock<typeof services.userTracker>();
    const mockApiUrlService = mock<typeof services.apiUrlService>();
    const mockConfig = mock<typeof services.privateConfig>();

    const mockProxy = {
      once: jest.fn().mockReturnThis(),
      web: jest.fn()
    };

    const mockHttpProxy = {
      createProxyServer: jest.fn().mockReturnValue(mockProxy)
    };

    mockProxy.once.mockImplementation((event, callback) => {
      if (event === "proxyRes") {
        setTimeout(() => callback(), 0);
      }
      return mockProxy;
    });

    mockGetSession.mockResolvedValue(input.session || null);
    mockApiUrlService.getBaseApiUrlFor.mockReturnValue("http://api.example.com");
    mockConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID = "mainnet";

    const req = mock<NextApiRequest>({
      method: "GET",
      url: input.url,
      headers: {
        "sentry-trace": "",
        traceparent: "",
        ...input.headers
      },
      socket: {
        remoteAddress: "127.0.0.1",
        ...input.socket
      } as NextApiRequest["socket"]
    });

    const res = mock<NextApiResponse>();

    (req as unknown as NextApiRequestWithServices)[REQ_SERVICES_KEY] = {
      ...services,
      logger: mockLogger,
      getSession: mockGetSession,
      httpProxy: mockHttpProxy,
      apiUrlService: mockApiUrlService,
      privateConfig: mockConfig,
      userTracker: mockUserTracker
    } satisfies typeof services;

    const handlerPromise = proxyHandler(req, res);

    return {
      req,
      res,
      mockLogger,
      mockProxy,
      handlerPromise
    };
  }
});
