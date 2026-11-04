import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

type CurrentUserBody = { data: { id: string; githubStarPromptedAt: string | null } };

describe("GitHub star prompt", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /v1/user/markGithubStarPrompted", () => {
    it("returns 401 when the user is not authenticated", async () => {
      const response = await app.request("/v1/user/markGithubStarPrompted", { method: "POST" });

      expect(response.status).toBe(401);
    });

    it("shows the current user as never prompted until they answer", async () => {
      const { token } = await setup();

      const meResponse = await app.request("/v1/user/me", { headers: { authorization: `Bearer ${token}` } });
      const me = (await meResponse.json()) as CurrentUserBody;

      expect(me.data.githubStarPromptedAt).toBeNull();
    });

    it("records the time and exposes it on the current user", async () => {
      const { user, token } = await setup();

      const response = await app.request("/v1/user/markGithubStarPrompted", { method: "POST", headers: { authorization: `Bearer ${token}` } });
      const meResponse = await app.request("/v1/user/me", { headers: { authorization: `Bearer ${token}` } });
      const me = (await meResponse.json()) as CurrentUserBody;

      expect(response.status).toBe(204);
      expect(me.data.id).toBe(user.id);
      expect(me.data.githubStarPromptedAt).toEqual(expect.any(String));
    });

    it("keeps the first time when called again", async () => {
      const { user, token } = await setup();
      const headers = { authorization: `Bearer ${token}` };

      await app.request("/v1/user/markGithubStarPrompted", { method: "POST", headers });
      const firstAt = (await userRepository.findById(user.id))?.githubStarPromptedAt;
      const secondResponse = await app.request("/v1/user/markGithubStarPrompted", { method: "POST", headers });
      const secondAt = (await userRepository.findById(user.id))?.githubStarPromptedAt;

      expect(secondResponse.status).toBe(204);
      expect(firstAt).toBeInstanceOf(Date);
      expect(secondAt).toEqual(firstAt);
    });
  });

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(12)}` });
    const token = faker.string.alphanumeric(40);

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => (header.replace(/^Bearer +/i, "") === token ? user.userId! : null));

    return { user, token };
  }
});
