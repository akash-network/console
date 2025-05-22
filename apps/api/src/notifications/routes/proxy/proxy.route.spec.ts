import { faker } from "@faker-js/faker";

import type { AuthService } from "@src/auth/services/auth.service";
import type { NotificationsConfig } from "@src/notifications/config";
import { createProxy } from "@src/notifications/routes/proxy/proxy.route";

import { stub } from "@test/services/stub";

describe("createProxy", () => {
  it("builds correct proxy handler for POST request", async () => {
    const { handler, context, fetchMock, authService, userId, fullUrl, body } = setupProxyTest();

    const result = await handler(context);

    expect(authService.throwUnlessCan).toHaveBeenCalledWith("manage", "Alert");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://proxy.example" + new URL(fullUrl).pathname + new URL(fullUrl).search,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
        headers: expect.objectContaining({
          "x-user-id": userId,
          "content-type": "application/json"
        })
      })
    );

    expect(result.status).toBe(200);
  });

  it("infers ContactPoint from URL and omits body for GET", async () => {
    const { handler, context, fetchMock, authService, userId, fullUrl } = setupProxyTest({ method: "GET" });

    context.req.text = async () => {
      throw new Error("should not be called for GET");
    };

    const result = await handler(context);

    expect(authService.throwUnlessCan).toHaveBeenCalledWith("manage", "ContactPoint");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://proxy.example" + new URL(fullUrl).pathname + new URL(fullUrl).search,
      expect.objectContaining({
        method: "GET",
        body: undefined,
        headers: expect.objectContaining({
          "x-user-id": userId
        })
      })
    );

    expect(result.status).toBe(204);
  });

  type SetupOptions = {
    method?: string;
  };

  function setupProxyTest(options: SetupOptions = {}) {
    const method = options.method ?? "POST";
    const path = method === "GET" ? "/v1/contact-points" : "/v1/alerts";
    const fullUrl = `http://localhost${path}?q=${faker.string.alpha(5)}`;
    const body = { data: faker.lorem.word() };
    const userId = faker.string.uuid();

    const authService = stub<AuthService>({
      currentUser: { id: userId },
      throwUnlessCan: jest.fn().mockReturnValue(undefined)
    });

    const config: NotificationsConfig = {
      NOTIFICATIONS_API_BASE_URL: "https://proxy.example"
    };

    const fetchMock = jest.fn().mockResolvedValue(new Response(null, { status: method === "GET" ? 204 : 200 }));

    const handler = createProxy(authService, config, fetchMock);

    const context = {
      req: {
        method,
        url: fullUrl,
        raw: {
          headers: new Headers({ "x-custom": faker.internet.domainWord() })
        },
        text: async () => JSON.stringify(body)
      }
    };

    return {
      handler,
      context,
      fetchMock,
      authService,
      userId,
      fullUrl,
      body
    };
  }
});
