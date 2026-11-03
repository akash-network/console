import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

describe("GET /v1/user/me", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns when the account was created", async () => {
    const { user, headers } = await setup();

    const response = await app.request("/v1/user/me", { headers });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { id: user.id, createdAt: user.createdAt!.toISOString() } });
  });

  async function setup() {
    const user = await container.resolve(UserRepository).create({
      userId: faker.string.uuid(),
      username: `user-${faker.string.alphanumeric(12)}`,
      email: faker.internet.email().toLowerCase(),
      emailVerified: true
    });
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? user.userId : null
    );

    return { user, headers: { authorization: `Bearer ${token}` } };
  }
});
