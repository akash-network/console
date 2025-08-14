import { faker } from "@faker-js/faker";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { AppContext } from "@src/core/types/app-context";
import type { NotificationsConfig } from "@src/notifications/config/env.config";
import { createProxy } from "@src/notifications/routes/proxy/proxy.route";

import { createAkashAddress } from "@test/seeders";
import { stub } from "@test/services/stub";

describe("createProxy", () => {
  it("builds correct proxy handler for POST request", async () => {
    const { handler, context, fetchMock, authService, userId, owner, fullUrl, body } = setupProxyTest();

    const result = await handler(context);

    expect(authService.throwUnlessCan).toHaveBeenCalledWith("manage", "Alert");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://proxy.example" + new URL(fullUrl).pathname + new URL(fullUrl).search,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
        headers: expect.objectContaining({
          "x-user-id": userId,
          "x-owner-address": owner,
          "content-type": "application/json"
        })
      })
    );

    expect(result.status).toBe(200);
  });

  it("infers NotificationChannel from URL and omits body for GET", async () => {
    const { handler, context, fetchMock, authService, userId, fullUrl } = setupProxyTest({ method: "GET" });

    context.req.text = async () => {
      throw new Error("should not be called for GET");
    };

    const result = await handler(context);

    expect(authService.throwUnlessCan).toHaveBeenCalledWith("manage", "NotificationChannel");

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
    const path = method === "GET" ? "/v1/notification-channels" : "/v1/alerts";
    const fullUrl = `http://localhost${path}?q=${faker.string.alpha(5)}`;
    const body = { data: faker.lorem.word() };
    const userId = faker.string.uuid();

    const authService = stub<AuthService>({
      currentUser: { id: userId },
      throwUnlessCan: jest.fn().mockReturnValue(undefined)
    });
    const owner = createAkashAddress();

    const userWalletRepository = stub<UserWalletRepository>({
      findOneByUserId() {
        return {
          address: owner
        };
      }
    });

    const config: NotificationsConfig = {
      NOTIFICATIONS_API_BASE_URL: "https://proxy.example"
    };

    const fetchMock = jest.fn().mockResolvedValue(new Response(null, { status: method === "GET" ? 204 : 200 }));

    const handler = createProxy(authService, userWalletRepository, config, fetchMock);

    const context = {
      req: {
        method,
        url: fullUrl,
        raw: {
          headers: new Headers({ "x-custom": faker.internet.domainWord() })
        },
        text: async () => JSON.stringify(body)
      },
      get: jest.fn().mockReturnValue(undefined)
    } as unknown as AppContext;

    return {
      handler,
      context,
      fetchMock,
      authService,
      userId,
      owner,
      fullUrl,
      body
    };
  }
});
