import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletRepository } from "@src/billing/repositories";
import { DEFAULT_BODY_LIMIT_BYTES } from "@src/core/config/body-limit.config";
import type { AppContext } from "@src/core/types/app-context";
import type { NotificationsConfig } from "@src/notifications/config/env.config";
import { createProxy, notificationsApiProxy } from "@src/notifications/routes/proxy/proxy.route";

import { createAkashAddress } from "@test/seeders";

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

    const authService = mock<AuthService>({
      currentUser: { id: userId },
      throwUnlessCan: vi.fn().mockReturnValue(undefined)
    });
    const owner = createAkashAddress();

    const userWalletRepository = mock<UserWalletRepository>({
      async findOneByUserId() {
        return {
          address: owner
        } as any;
      }
    });

    const config: NotificationsConfig = {
      NOTIFICATIONS_API_BASE_URL: "https://proxy.example"
    };

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: method === "GET" ? 204 : 200 }));

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
      get: vi.fn().mockReturnValue(undefined)
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

describe("notificationsApiProxy", () => {
  it.each([
    ["POST", "/v1/notification-channels"],
    ["PATCH", `/v1/notification-channels/${faker.string.uuid()}`],
    ["DELETE", `/v1/notification-channels/${faker.string.uuid()}`],
    ["POST", "/v1/alerts"],
    ["PATCH", `/v1/alerts/${faker.string.uuid()}`],
    ["DELETE", `/v1/alerts/${faker.string.uuid()}`],
    ["POST", "/v1/deployment-alerts"],
    ["PATCH", `/v1/deployment-alerts/${faker.string.uuid()}`]
  ])("responds with 413 to %s %s carrying a body over the limit", async (method, path) => {
    const response = await requestWithBodyOf(DEFAULT_BODY_LIMIT_BYTES + 1, { method, path });

    expect(response.status).toBe(413);
  });

  it("lets a body within the limit through to the handler", async () => {
    const response = await requestWithBodyOf(DEFAULT_BODY_LIMIT_BYTES, { method: "POST", path: "/v1/notification-channels" });

    expect(response.status).not.toBe(413);
  });

  function requestWithBodyOf(sizeInBytes: number, input: { method: string; path: string }) {
    const body = "x".repeat(sizeInBytes);

    return notificationsApiProxy.request(input.path, {
      method: input.method,
      body,
      headers: { "content-length": String(body.length) }
    });
  }
});
