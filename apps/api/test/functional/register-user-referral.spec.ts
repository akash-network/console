import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import type { RegisterUserResponse } from "@src/user/routes/register-user/register-user.router";

describe("POST /v1/register-user referral attribution", () => {
  const userRepository = container.resolve(UserRepository);
  const affiliateRepository = container.resolve(AffiliateRepository);
  const referralRepository = container.resolve(ReferralRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("attributes a new sign-up to the affiliate whose code it arrived with", async () => {
    const { token } = stubToken();
    const affiliate = await seedAffiliate();

    const response = await register({ token, referralCode: affiliate.code });
    const body = (await response.json()) as RegisterUserResponse;

    expect(response.status).toBe(200);
    await expect(referralRepository.findByReferredUserId(body.data.id)).resolves.toMatchObject({ affiliateId: affiliate.id });
  });

  it("keeps the first attribution on a later login that carries a different code", async () => {
    const { token } = stubToken();
    const first = await seedAffiliate();
    const second = await seedAffiliate();
    const firstResponse = await register({ token, referralCode: first.code });
    const firstBody = (await firstResponse.json()) as RegisterUserResponse;

    await register({ token, referralCode: second.code });

    await expect(referralRepository.findByReferredUserId(firstBody.data.id)).resolves.toMatchObject({ affiliateId: first.id });
  });

  it("does not attribute a referral when an existing user registers again with a code", async () => {
    const { token } = stubToken();
    const initialResponse = await register({ token });
    const initialBody = (await initialResponse.json()) as RegisterUserResponse;
    const affiliate = await seedAffiliate();

    await register({ token, referralCode: affiliate.code });

    await expect(referralRepository.findByReferredUserId(initialBody.data.id)).resolves.toBeUndefined();
  });

  it("attributes a sign-up when the affiliate program is rolled out only to the referring affiliate", async () => {
    const affiliate = await seedAffiliate();
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(
      (flag, context) => flag !== FeatureFlags.AFFILIATE_PROGRAM || context?.userId === affiliate.userId
    );
    const { token } = stubToken();

    const response = await register({ token, referralCode: affiliate.code });
    const body = (await response.json()) as RegisterUserResponse;

    expect(response.status).toBe(200);
    await expect(referralRepository.findByReferredUserId(body.data.id)).resolves.toMatchObject({ affiliateId: affiliate.id });
  });

  it("does not create a referral row when the affiliate program flag is off", async () => {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag !== FeatureFlags.AFFILIATE_PROGRAM);
    const { token } = stubToken();
    const affiliate = await seedAffiliate();

    const response = await register({ token, referralCode: affiliate.code });
    const body = (await response.json()) as RegisterUserResponse;

    expect(response.status).toBe(200);
    await expect(referralRepository.findByReferredUserId(body.data.id)).resolves.toBeUndefined();
  });

  function stubToken() {
    const externalUserId = faker.string.uuid();
    const token = faker.string.alphanumeric(40);

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => (header.replace(/^Bearer +/i, "") === token ? externalUserId : null));

    return { token, externalUserId };
  }

  async function seedAffiliate() {
    const owner = await userRepository.create({ userId: faker.string.uuid() });

    return affiliateRepository.create({
      userId: owner.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });
  }

  function register({ token, referralCode }: { token: string; referralCode?: string }) {
    return app.request("/v1/register-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        wantedUsername: faker.internet.userName(),
        email: faker.internet.email(),
        emailVerified: true,
        ...(referralCode ? { referralCode } : {})
      })
    });
  }
});
