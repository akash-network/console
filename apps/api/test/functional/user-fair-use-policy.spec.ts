import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

describe("Fair Use Policy acceptance", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /v1/user/acceptFairUsePolicy", () => {
    it("returns 401 when the user is not authenticated", async () => {
      const response = await app.request("/v1/user/acceptFairUsePolicy", { method: "POST" });

      expect(response.status).toBe(401);
    });

    it("records the acceptance and exposes it on the current user", async () => {
      const { user, token } = await setup();

      const response = await app.request("/v1/user/acceptFairUsePolicy", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` }
      });
      const meResponse = await app.request("/v1/user/me", { headers: { authorization: `Bearer ${token}` } });
      const me = (await meResponse.json()) as { data: { id: string; fairUsePolicyAcceptedAt: string | null } };

      expect(response.status).toBe(204);
      expect(me.data.id).toBe(user.id);
      expect(me.data.fairUsePolicyAcceptedAt).toEqual(expect.any(String));
    });

    it("keeps the first acceptance time when called again", async () => {
      const { user, token } = await setup();
      const headers = { authorization: `Bearer ${token}` };

      await app.request("/v1/user/acceptFairUsePolicy", { method: "POST", headers });
      const firstAcceptedAt = (await userRepository.findById(user.id))?.fairUsePolicyAcceptedAt;
      await app.request("/v1/user/acceptFairUsePolicy", { method: "POST", headers });
      const secondAcceptedAt = (await userRepository.findById(user.id))?.fairUsePolicyAcceptedAt;

      expect(firstAcceptedAt).toBeInstanceOf(Date);
      expect(secondAcceptedAt).toEqual(firstAcceptedAt);
    });
  });

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(12)}` });
    const token = faker.string.alphanumeric(40);

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => (header.replace(/^Bearer +/i, "") === token ? user.userId! : null));

    return { user, token };
  }
});
