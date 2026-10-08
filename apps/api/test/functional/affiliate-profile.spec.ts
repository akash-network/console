import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

describe("GET /v1/affiliates/me", () => {
  const userRepository = container.resolve(UserRepository);
  const affiliateRepository = container.resolve(AffiliateRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("returns 401 when the caller is not authenticated", async () => {
    const response = await request();

    expect(response.status).toBe(401);
  });

  it("returns null data for an authenticated user who has never been an affiliate", async () => {
    const { token } = await setup();

    const response = await request(token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: null });
  });

  it("returns null data for a revoked affiliate", async () => {
    const { token, user } = await setup();
    await affiliateRepository.create({
      userId: user.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network",
      revokedAt: new Date(),
      revokedBy: "ops@akash.network"
    });

    const response = await request(token);

    expect(await response.json()).toEqual({ data: null });
  });

  it("returns the code and terms for an approved affiliate", async () => {
    const { token, user } = await setup();
    await affiliateRepository.create({
      userId: user.id,
      code: "friendcode",
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });

    const response = await request(token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        code: "friendcode",
        terms: { commissionPercent: 5, commissionMonths: 12, referralTrialCreditsUsd: expect.any(Number) }
      }
    });
  });

  it("does not expose another user's affiliate profile", async () => {
    const { token } = await setup();
    const stranger = await setup();
    await affiliateRepository.create({
      userId: stranger.user.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });

    const response = await request(token);

    expect(await response.json()).toEqual({ data: null });
  });

  async function request(token?: string) {
    return app.request("/v1/affiliates/me", {
      method: "GET",
      headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }
    });
  }

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const token = faker.string.alphanumeric(40);
    const otherTokens = vi.isMockFunction(userAuthTokenService.getValidUserId)
      ? vi.mocked(userAuthTokenService.getValidUserId).getMockImplementation()
      : undefined;

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? user.userId! : (await otherTokens?.(header)) ?? null
    );

    return { user, token };
  }
});
