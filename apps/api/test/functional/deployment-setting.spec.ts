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
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

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
          closed: false
        }
      });
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

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const walletAddress = createAkashAddress();
    const token = faker.string.alphanumeric(40);

    const wallet = UserWalletSeeder.create({ userId: user.id, address: walletAddress });

    vi.spyOn(userAuthTokenService, "getValidUserId").mockResolvedValue(user.userId);
    vi.spyOn(userWalletRepository, "accessibleBy").mockReturnValue(userWalletRepository);
    vi.spyOn(userWalletRepository, "findFirst").mockResolvedValue(wallet);
    vi.spyOn(userWalletRepository, "findOneByUserId").mockResolvedValue(wallet);
    vi.spyOn(leaseRepository, "findOneByDseqAndOwner").mockResolvedValue(DrainingDeploymentSeeder.create());

    return { user, token, wallet };
  }
});
