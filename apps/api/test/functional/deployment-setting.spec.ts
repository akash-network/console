import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDrainingDeployment } from "@test/seeders/draining-deployment.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe("Deployment Settings", () => {
  const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
  const leaseRepository = container.resolve(LeaseRepository);
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);
  const userWalletRepository = container.resolve(UserWalletRepository);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /v1/deployment-settings/{userId}/{dseq}", () => {
    it("returns 401 if user is not authenticated", async () => {
      const response = await app.request("/v1/deployment-settings/123/456");
      expect(response.status).toBe(401);
    });

    it("returns a new deployment setting if not found", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();

      const response = await app.request(`/v1/deployment-settings/${user.id}/${dseq}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          id: expect.any(String),
          userId: user.id,
          dseq,
          autoTopUpEnabled: true,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          estimatedTopUpAmount: expect.any(Number),
          topUpFrequencyMs: expect.any(Number),
          runtimeLimitHours: null,
          runtimeEndsAt: null,
          closed: false
        }
      });
    });

    it("hands back none of what the console remembers the deployment by", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG" });

      const response = await app.request(`/v1/deployment-settings/${user.id}/${dseq}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.status).toBe(200);
      const { data } = (await response.json()) as { data: Record<string, unknown> };
      expect(data).not.toHaveProperty("sdl");
      expect(data).not.toHaveProperty("manifestVersion");
    });

    it("enables auto top-up on a lazily created row without consulting the owner's wallet", async () => {
      const { token, user } = await setup({ hasManagedWallet: false });
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();

      const response = await app.request(`/v1/deployment-settings/${user.id}/${dseq}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: expect.objectContaining({ autoTopUpEnabled: true }) });
    });

    it("returns 404 when accessing other user's deployment settings", async () => {
      const { user: user1 } = await setup();
      const { token: token2 } = await setup();

      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.create({
        userId: user1.id,
        dseq,
        autoTopUpEnabled: true
      });

      const response = await app.request(`/v1/deployment-settings/${user1.id}/${dseq}`, {
        headers: {
          authorization: `Bearer ${token2}`
        }
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: "NotFoundError",
        message: "Deployment setting not found",
        code: "not_found",
        type: "client_error"
      });
    });

    it("returns deployment settings if found", async () => {
      const { token, user, wallet } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();

      const settings = await deploymentSettingRepository.create({
        userId: user.id,
        dseq,
        autoTopUpEnabled: true
      });

      const response = await app.request(`/v1/deployment-settings/${user.id}/${dseq}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          id: settings.id,
          userId: user.id,
          dseq,
          autoTopUpEnabled: true,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          estimatedTopUpAmount: expect.any(Number),
          topUpFrequencyMs: expect.any(Number),
          runtimeLimitHours: null,
          runtimeEndsAt: null,
          closed: false
        }
      });
      expect(leaseRepository.findOneByDseqAndOwner).toHaveBeenCalledWith(dseq, wallet.address);
    });
  });

  describe("POST /v1/deployment-settings", () => {
    it("returns 401 if user is not authenticated", async () => {
      const response = await app.request("/v1/deployment-settings", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            userId: faker.string.uuid(),
            dseq: faker.number.int({ min: 1, max: 1000000 }).toString(),
            autoTopUpEnabled: true
          }
        })
      });

      expect(response.status).toBe(401);
    });

    it("succeeds for a deployment whose creation already recorded its definition", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG" });

      const response = await app.request("/v1/deployment-settings", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ data: { userId: user.id, dseq, autoTopUpEnabled: true } })
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { dseq: string; autoTopUpEnabled: boolean } };
      expect(data).toMatchObject({ dseq, autoTopUpEnabled: true });
    });

    it("leaves the recorded definition alone when settings are created for the same deployment", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "BAUG" });

      await app.request("/v1/deployment-settings", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ data: { userId: user.id, dseq, autoTopUpEnabled: true } })
      });

      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ sdl: "version: '2.0'", manifestVersion: "BAUG" });
    });

    it("returns 403 when creating deployment settings for another user", async () => {
      const { user: user1 } = await setup();
      const { token: token2 } = await setup();

      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();

      const response = await app.request("/v1/deployment-settings", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token2}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            userId: user1.id,
            dseq,
            autoTopUpEnabled: true
          }
        })
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: "ForbiddenError",
        message: "Forbidden",
        code: "forbidden",
        type: "authorization_error"
      });
    });

    it("creates deployment settings", async () => {
      const { token, user, wallet } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();

      const response = await app.request("/v1/deployment-settings", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            userId: user.id,
            dseq,
            autoTopUpEnabled: true
          }
        })
      });

      expect(response.status).toBe(201);
      const result = (await response.json()) as { data: unknown };
      expect(result.data).toMatchObject({
        userId: user.id,
        dseq,
        autoTopUpEnabled: true
      });

      const settings = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq });
      expect(settings).toBeDefined();
      expect(settings).toMatchObject({
        userId: user.id,
        dseq,
        autoTopUpEnabled: true
      });
      expect(leaseRepository.findOneByDseqAndOwner).toHaveBeenCalledWith(dseq, wallet.address);
    });
  });

  describe("PATCH /v1/deployment-settings/{userId}/{dseq}", () => {
    it("returns 401 if user is not authenticated", async () => {
      const response = await app.request("/v1/deployment-settings/123/456", {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            autoTopUpEnabled: true
          }
        })
      });

      expect(response.status).toBe(401);
    });

    it("creates and returns new setting if not found", async () => {
      const { token, user, wallet } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();

      const response = await app.request(`/v1/deployment-settings/${user.id}/${dseq}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            autoTopUpEnabled: true
          }
        })
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as { data: unknown };
      expect(result.data).toMatchObject({
        userId: user.id,
        dseq,
        autoTopUpEnabled: true
      });

      const settings = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq });
      expect(settings).toBeDefined();
      expect(settings).toMatchObject({
        userId: user.id,
        dseq,
        autoTopUpEnabled: true
      });
      expect(leaseRepository.findOneByDseqAndOwner).toHaveBeenCalledWith(dseq, wallet.address);
    });

    it("returns 404 when updating other user's deployment settings", async () => {
      const { user: user1 } = await setup();
      const { token: token2 } = await setup();

      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.create({
        userId: user1.id,
        dseq,
        autoTopUpEnabled: false
      });

      const response = await app.request(`/v1/deployment-settings/${user1.id}/${dseq}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token2}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            autoTopUpEnabled: true
          }
        })
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: "NotFoundError",
        message: "Deployment setting not found",
        code: "not_found",
        type: "client_error"
      });
    });

    it("updates deployment settings", async () => {
      const { token, user, wallet } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();

      const settings = await deploymentSettingRepository.create({
        userId: user.id,
        dseq,
        autoTopUpEnabled: false
      });

      const response = await app.request(`/v1/deployment-settings/${user.id}/${dseq}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            autoTopUpEnabled: true
          }
        })
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as { data: unknown };
      expect(result.data).toMatchObject({
        id: settings.id,
        userId: user.id,
        dseq,
        autoTopUpEnabled: true
      });

      const updatedSettings = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq });
      expect(updatedSettings).toBeDefined();
      expect(updatedSettings).toMatchObject({
        id: settings.id,
        userId: user.id,
        dseq,
        autoTopUpEnabled: true
      });
      expect(leaseRepository.findOneByDseqAndOwner).toHaveBeenCalledWith(dseq, wallet.address);
    });
  });

  describe("PATCH /v2/deployment-settings/{dseq} with a runtime limit", () => {
    it("sets a first runtime limit and leaves it unanchored", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true });

      const response = await patchRuntimeLimit({ dseq, token, runtimeLimitHours: 12 });

      expect(response.status).toBe(200);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({
        runtimeLimitHours: 12,
        runtimeEndsAt: null
      });
    });

    it("shifts an anchored deadline by the extension delta", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      const runtimeEndsAt = faker.date.future();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true, runtimeLimitHours: 12, runtimeEndsAt });

      const response = await patchRuntimeLimit({ dseq, token, runtimeLimitHours: 20 });

      expect(response.status).toBe(200);
      const updated = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq });
      expect(updated?.runtimeLimitHours).toBe(20);
      expect(updated?.runtimeEndsAt?.getTime()).toBe(runtimeEndsAt.getTime() + 8 * 60 * 60 * 1000);
    });

    it("returns 400 when lowering a runtime limit", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true, runtimeLimitHours: 24 });

      const response = await patchRuntimeLimit({ dseq, token, runtimeLimitHours: 12 });

      expect(response.status).toBe(400);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ runtimeLimitHours: 24 });
    });

    it("returns 400 when an extension exceeds the 48 hour increment", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true, runtimeLimitHours: 24 });

      const response = await patchRuntimeLimit({ dseq, token, runtimeLimitHours: 73 });

      expect(response.status).toBe(400);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ runtimeLimitHours: 24 });
    });

    it("returns 400 for a first runtime limit above 48 hours", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true });

      const response = await patchRuntimeLimit({ dseq, token, runtimeLimitHours: 49 });

      expect(response.status).toBe(400);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ runtimeLimitHours: null });
    });

    it("returns 400 when the deployment is already closed", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true, runtimeLimitHours: 12, closed: true });

      const response = await patchRuntimeLimit({ dseq, token, runtimeLimitHours: 24 });

      expect(response.status).toBe(400);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ runtimeLimitHours: 12 });
    });
  });

  describe("PATCH /v2/deployment-settings/{dseq} removing a runtime limit", () => {
    it("clears the limit and its deadline, leaving auto top-up on", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true, runtimeLimitHours: 12, runtimeEndsAt: faker.date.future() });

      const response = await patchRuntimeLimit({ dseq, token, runtimeLimitHours: null });

      expect(response.status).toBe(200);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({
        runtimeLimitHours: null,
        runtimeEndsAt: null,
        autoTopUpEnabled: true
      });
    });

    it("leaves an already unlimited deployment alone", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true });

      const response = await patchRuntimeLimit({ dseq, token, runtimeLimitHours: null });

      expect(response.status).toBe(200);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ runtimeLimitHours: null, runtimeEndsAt: null });
    });

    it("returns 400 when the deployment is already closed", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true, runtimeLimitHours: 12, closed: true });

      const response = await patchRuntimeLimit({ dseq, token, runtimeLimitHours: null });

      expect(response.status).toBe(400);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ runtimeLimitHours: 12 });
    });
  });

  describe("disabling automatic funding", () => {
    it("returns 400 for a PATCH turning auto top-up off", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true });

      const response = await app.request(`/v1/deployment-settings/${user.id}/${dseq}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ data: { autoTopUpEnabled: false } })
      });

      expect(response.status).toBe(400);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ autoTopUpEnabled: true });
    });

    it("returns 400 when an opt-out arrives alongside a runtime limit", async () => {
      const { token, user } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();
      await deploymentSettingRepository.create({ userId: user.id, dseq, autoTopUpEnabled: true });

      const response = await app.request(`/v2/deployment-settings/${dseq}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ data: { autoTopUpEnabled: false, runtimeLimitHours: 12 } })
      });

      expect(response.status).toBe(400);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({ runtimeLimitHours: null });
    });

    it("returns 400 for a POST creating a setting with funding off", async () => {
      const { token } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();

      const response = await app.request("/v2/deployment-settings", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ data: { dseq, autoTopUpEnabled: false } })
      });

      expect(response.status).toBe(400);
    });

    it("creates a funded setting when the field is omitted", async () => {
      const { token } = await setup();
      const dseq = faker.number.int({ min: 1, max: 1000000 }).toString();

      const response = await app.request("/v2/deployment-settings", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ data: { dseq } })
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ data: expect.objectContaining({ autoTopUpEnabled: true }) });
    });
  });

  function patchRuntimeLimit({ dseq, token, runtimeLimitHours }: { dseq: string; token: string; runtimeLimitHours: number | null }) {
    return app.request(`/v2/deployment-settings/${dseq}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ data: { runtimeLimitHours } })
    });
  }

  async function setup(input: { hasManagedWallet?: boolean } = {}) {
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const walletAddress = createAkashAddress();
    const token = faker.string.alphanumeric(40);

    const wallet = createUserWallet({ userId: user.id, address: walletAddress });
    const resolvedWallet = input.hasManagedWallet === false ? undefined : wallet;

    vi.spyOn(userAuthTokenService, "getValidUserId").mockResolvedValue(user.userId);
    vi.spyOn(userWalletRepository, "accessibleBy").mockReturnValue(userWalletRepository);
    vi.spyOn(userWalletRepository, "findFirst").mockResolvedValue(resolvedWallet);
    vi.spyOn(userWalletRepository, "findOneByUserId").mockResolvedValue(resolvedWallet);
    vi.spyOn(leaseRepository, "findOneByDseqAndOwner").mockResolvedValue(createDrainingDeployment());

    return { user, token, wallet };
  }
});
