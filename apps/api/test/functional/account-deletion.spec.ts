import { faker } from "@faker-js/faker";
import { createHash } from "crypto";
import { addMinutes, subMinutes } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { CORE_CONFIG, JOB_NAME } from "@src/core";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { app } from "@src/rest-app";
import { AccountDeletionTokenRepository } from "@src/user/repositories/account-deletion-token/account-deletion-token.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { PurgeDeletedAccount } from "@src/user/services/purge-deleted-account/purge-deleted-account.handler";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { findJobRows } from "@test/services/job-queue-harness";

interface ErrorBody {
  code: string;
  data?: Record<string, unknown>;
}

describe("Account deletion", () => {
  const userRepository = container.resolve(UserRepository);
  const tokenRepository = container.resolve(AccountDeletionTokenRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("POST /v1/user/me/initiate-deletion", () => {
    it("returns 401 when the user is not authenticated", async () => {
      const response = await initiate({}, { forfeitAcknowledged: false });

      expect(response.status).toBe(401);
    });

    it("refuses a request authenticated with an API key", async () => {
      const { user } = await setupSignedInUser();
      const apiKey = await seedApiKey(user.id);

      const response = await initiate({ "x-api-key": apiKey }, { forfeitAcknowledged: false });

      expect(response.status).toBe(403);
      expect(((await response.json()) as ErrorBody).code).toBe("session_required");
      expect(await tokenRepository.findByUserId(user.id)).toBeUndefined();
    });

    it("emails a confirmation link whose token it stores only as a hash", async () => {
      const { user, token } = await setupSignedInUser();
      const sentNotifications = interceptNotifications();

      const response = await initiate({ authorization: `Bearer ${token}` }, { forfeitAcknowledged: false });

      expect(response.status).toBe(204);
      expect(sentNotifications).toHaveLength(1);
      const confirmUrl = new URL(sentNotifications[0].payload.actions[0].url);
      expect(confirmUrl.pathname).toBe("/user/confirm-delete");
      const linkToken = confirmUrl.searchParams.get("token")!;
      expect(await tokenRepository.findByUserId(user.id)).toMatchObject({ tokenHash: sha256(linkToken), forfeitAcknowledged: false });
    });

    it("refuses an account with active deployments and names them", async () => {
      const { user, token, address } = await setupSignedInUser({ withWallet: true });
      const deployment = createDeploymentInfoSeed({ owner: address, state: "active" });
      answerActiveDeployments([deployment]);

      const response = await initiate({ authorization: `Bearer ${token}` }, { forfeitAcknowledged: true });
      const body = (await response.json()) as ErrorBody;

      expect(response.status).toBe(409);
      expect(body.code).toBe("active_deployments");
      expect(body.data).toEqual({ activeDeploymentCount: 1, dseqs: [deployment.deployment.id.dseq] });
      expect(await tokenRepository.findByUserId(user.id)).toBeUndefined();
    });

    it("refuses another link within a minute of the last one", async () => {
      const { user, token } = await setupSignedInUser();
      await tokenRepository.replaceForUser({
        userId: user.id,
        tokenHash: sha256(faker.string.alphanumeric(43)),
        forfeitAcknowledged: false,
        expiresAt: addMinutes(new Date(), 15)
      });

      const response = await initiate({ authorization: `Bearer ${token}` }, { forfeitAcknowledged: false });

      expect(response.status).toBe(429);
      expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    });
  });

  describe("POST /v1/user/me/confirm-deletion", () => {
    it("deletes the account the link was issued for and queues the cleanup of its external records", async () => {
      const { user, linkToken } = await setupIssuedLink();

      const response = await confirm(linkToken);

      expect(response.status).toBe(204);
      expect(await userRepository.findById(user.id)).toBeUndefined();
      expect(await findJobRows(PurgeDeletedAccount[JOB_NAME], { data: { userId: user.id } })).toHaveLength(1);
    });

    it("refuses a token no link was issued for", async () => {
      const response = await confirm(faker.string.alphanumeric(43));

      expect(response.status).toBe(400);
      expect(((await response.json()) as ErrorBody).code).toBe("invalid_deletion_token");
    });

    it("refuses an expired link and keeps the account", async () => {
      const { user, linkToken } = await setupIssuedLink({ expiresAt: subMinutes(new Date(), 1) });

      const response = await confirm(linkToken);

      expect(response.status).toBe(400);
      expect(((await response.json()) as ErrorBody).code).toBe("expired_deletion_token");
      expect(await userRepository.findById(user.id)).toBeDefined();
    });
  });

  function sha256(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  async function initiate(headers: Record<string, string>, data: { forfeitAcknowledged: boolean }) {
    return await app.request("/v1/user/me/initiate-deletion", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ data })
    });
  }

  async function confirm(token: string) {
    return await app.request("/v1/user/me/confirm-deletion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { token } })
    });
  }

  async function setupSignedInUser(input: { withWallet?: boolean } = {}) {
    const userOverrides = {
      userId: `auth0|${faker.string.alphanumeric(24)}`,
      username: `user-${faker.string.alphanumeric(12)}`,
      email: faker.internet.email()
    };
    const { user, address } = input.withWallet
      ? await seedUserWithWallet({ isTrialing: true, user: userOverrides })
      : { user: await userRepository.create(userOverrides), address: undefined };
    const token = faker.string.alphanumeric(40);

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => (header.replace(/^Bearer +/i, "") === token ? user.userId! : null));

    return { user, token, address: address! };
  }

  async function setupIssuedLink(input: { expiresAt?: Date } = {}) {
    const user = await userRepository.create({ userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` });
    const linkToken = faker.string.alphanumeric(43);
    await tokenRepository.replaceForUser({
      userId: user.id,
      tokenHash: sha256(linkToken),
      forfeitAcknowledged: false,
      expiresAt: input.expiresAt ?? addMinutes(new Date(), 15)
    });

    return { user, linkToken };
  }

  async function seedApiKey(userId: string) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();
    await container.resolve(ApiKeyRepository).create({
      userId,
      hashedKey: await apiKeyGenerator.hashApiKey(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey),
      name: "ci"
    });

    return apiKey;
  }

  function interceptNotifications() {
    const sent: Array<{ payload: { actions: Array<{ url: string }> } }> = [];
    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL!)
      .post("/internal/v1/jobs/notification", body => {
        sent.push(body);
        return true;
      })
      .reply(204);

    return sent;
  }

  function answerActiveDeployments(deployments: ReturnType<typeof createDeploymentInfoSeed>[]) {
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get("/akash/deployment/v1beta4/deployments/list")
      .query(true)
      .reply(200, { deployments, pagination: { next_key: null, total: String(deployments.length) } });
  }
});
