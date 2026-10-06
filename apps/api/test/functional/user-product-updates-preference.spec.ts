import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

describe("Product update emails preference", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("PUT /v1/user/updateSettings", () => {
    it("records the opt-out and exposes it on the current user", async () => {
      const { user, headers } = await setup({ productUpdatesUnsubscribedAt: null });

      const response = await updateSettings(headers, { username: user.username, subscribedToProductUpdates: false });
      const me = await getCurrentUser(headers);

      expect(response.status).toBe(204);
      expect(me.data.productUpdatesUnsubscribedAt).toEqual(expect.any(String));
    });

    it("clears the opt-out when product updates are switched back on", async () => {
      const { user, headers } = await setup({ productUpdatesUnsubscribedAt: faker.date.past() });

      const response = await updateSettings(headers, { username: user.username, subscribedToProductUpdates: true });
      const me = await getCurrentUser(headers);

      expect(response.status).toBe(204);
      expect(me.data.productUpdatesUnsubscribedAt).toBeNull();
    });
  });

  function updateSettings(headers: Record<string, string>, body: Record<string, unknown>) {
    return app.request("/v1/user/updateSettings", {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async function getCurrentUser(headers: Record<string, string>) {
    const response = await app.request("/v1/user/me", { headers });
    return (await response.json()) as { data: { productUpdatesUnsubscribedAt: string | null } };
  }

  async function setup(input: { productUpdatesUnsubscribedAt: Date | null }) {
    const user = await userRepository.create({
      userId: faker.string.uuid(),
      username: `user-${faker.string.alphanumeric(12)}`,
      productUpdatesUnsubscribedAt: input.productUpdatesUnsubscribedAt
    });
    const token = faker.string.alphanumeric(40);

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => (header.replace(/^Bearer +/i, "") === token ? user.userId! : null));

    return { user, headers: { authorization: `Bearer ${token}` } };
  }
});
