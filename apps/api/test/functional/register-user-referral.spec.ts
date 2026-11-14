import { faker } from "@faker-js/faker";
import type { GetUsers200ResponseOneOfInner } from "auth0";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import type { RegisterUserResponse } from "@src/user/routes/register-user/register-user.router";

type Device = { ip: string; userAgent: string };

describe("POST /v1/register-user referral attribution", () => {
  const userRepository = container.resolve(UserRepository);
  const affiliateRepository = container.resolve(AffiliateRepository);
  const referralRepository = container.resolve(ReferralRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);
  const logins = new Map<string, { externalUserId: string; email: string }>();

  afterEach(() => {
    vi.restoreAllMocks();
    logins.clear();
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

  it("does not link a sign-up whose email is a variant of the affiliate's", async () => {
    const affiliateEmail = faker.internet.email().toLowerCase();
    const affiliate = await seedAffiliate({ email: affiliateEmail });
    const { token } = stubToken({ email: affiliateEmail.replace("@", "+second@") });

    const response = await register({ token, referralCode: affiliate.code });
    const body = (await response.json()) as RegisterUserResponse;

    expect(response.status).toBe(200);
    await expect(referralRepository.findByReferredUserId(body.data.id)).resolves.toBeUndefined();
  });

  it("does not link a sign-up from the affiliate's own device", async () => {
    const device = { ip: faker.internet.ipv4(), userAgent: faker.internet.userAgent() };
    const affiliate = await registerAffiliate(device);
    const { token } = stubToken();

    const response = await register({ token, referralCode: affiliate.code, device });
    const body = (await response.json()) as RegisterUserResponse;

    expect(response.status).toBe(200);
    await expect(referralRepository.findByReferredUserId(body.data.id)).resolves.toBeUndefined();
  });

  it("links a sign-up from another device to the affiliate", async () => {
    const affiliate = await registerAffiliate({ ip: faker.internet.ipv4(), userAgent: "affiliate-browser" });
    const { token } = stubToken();

    const response = await register({ token, referralCode: affiliate.code, device: { ip: faker.internet.ipv4(), userAgent: "friend-browser" } });
    const body = (await response.json()) as RegisterUserResponse;

    expect(response.status).toBe(200);
    await expect(referralRepository.findByReferredUserId(body.data.id)).resolves.toMatchObject({ affiliateId: affiliate.id });
  });

  function stubToken(input?: { email?: string }) {
    const externalUserId = faker.string.uuid();
    const token = faker.string.alphanumeric(40);
    logins.set(token, { externalUserId, email: input?.email ?? faker.internet.email() });

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => logins.get(header.replace(/^Bearer +/i, ""))?.externalUserId ?? null);
    vi.spyOn(container.resolve(Auth0Service), "getUser").mockImplementation(async userId => {
      const login = [...logins.values()].find(candidate => candidate.externalUserId === userId);
      return login ? mock<GetUsers200ResponseOneOfInner>({ user_id: userId, email: login.email, email_verified: true }) : null;
    });

    return { token, externalUserId };
  }

  async function seedAffiliate(input?: { email?: string }) {
    const owner = await userRepository.create({ userId: faker.string.uuid(), email: input?.email });

    return approveAffiliate(owner.id);
  }

  async function registerAffiliate(device: Device) {
    const { token } = stubToken();
    const response = await register({ token, device });
    const body = (await response.json()) as RegisterUserResponse;

    return approveAffiliate(body.data.id);
  }

  function approveAffiliate(userId: string) {
    return affiliateRepository.create({
      userId,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });
  }

  function register({ token, referralCode, device }: { token: string; referralCode?: string; device?: Device }) {
    return app.request(
      "/v1/register-user",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
          ...(device ? { "cf-connecting-ip": device.ip, "User-Agent": device.userAgent } : {})
        },
        body: JSON.stringify({
          wantedUsername: faker.internet.userName(),
          ...(referralCode ? { referralCode } : {})
        })
      },
      device ? { incoming: { socket: { remoteAddress: device.ip, remotePort: 443, remoteFamily: "IPv4" } } } : undefined
    );
  }
});
