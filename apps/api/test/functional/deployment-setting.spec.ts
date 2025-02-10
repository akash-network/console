import { faker } from "@faker-js/faker";
import { container } from "tsyringe";

import { app } from "@src/app";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";

import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";
import { DbTestingService } from "@test/services/db-testing.service";
import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(20000);

describe("Deployment Settings", () => {
  const dbService = container.resolve(DbTestingService);
  const walletService = new WalletTestingService(app);
  const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
  const leaseRepository = container.resolve(LeaseRepository);

  beforeEach(() => {
    jest.spyOn(leaseRepository, "findOneByDseqAndOwner").mockResolvedValue(DrainingDeploymentSeeder.create());
  });

  afterEach(async () => {
    await dbService.cleanAll();
    jest.restoreAllMocks();
  });

  describe("GET /v1/deployment-settings/{userId}/{dseq}", () => {
    it("should return 401 if user is not authenticated", async () => {
      const response = await app.request("/v1/deployment-settings/123/456");
      expect(response.status).toBe(401);
    });

    it("should return a new deployment setting if not found", async () => {
      const { token, user } = await walletService.createUserAndWallet();
      const dseq = faker.string.numeric();

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
          autoTopUpEnabled: false,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          estimatedTopUpAmount: expect.any(Number),
          topUpFrequencyMs: expect.any(Number),
          closed: false
        }
      });
    });

    it("should return 404 when accessing other user's deployment settings", async () => {
      const [{ user: user1 }, { token: token2 }] = await Promise.all([walletService.createUserAndWallet(), walletService.createUserAndWallet()]);

      const dseq = faker.string.numeric();
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
        message: "Deployment setting not found"
      });
    });

    it("should return deployment settings if found", async () => {
      const { token, user, wallet } = await walletService.createUserAndWallet();
      const dseq = faker.string.numeric();

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
    it("should return 401 if user is not authenticated", async () => {
      const response = await app.request("/v1/deployment-settings", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            userId: faker.string.uuid(),
            dseq: faker.string.numeric(),
            autoTopUpEnabled: true
          }
        })
      });

      expect(response.status).toBe(401);
    });

    it("should return 403 when creating deployment settings for another user", async () => {
      const [{ user: user1 }, { token: token2 }] = await Promise.all([walletService.createUserAndWallet(), walletService.createUserAndWallet()]);

      const dseq = faker.string.numeric();

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
        message: "Forbidden"
      });
    });

    it("should create deployment settings", async () => {
      const { token, user, wallet } = await walletService.createUserAndWallet();
      const dseq = faker.string.numeric();

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
      const result = await response.json();
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
    it("should return 401 if user is not authenticated", async () => {
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

    it("should create and return new setting if not found", async () => {
      const { token, user, wallet } = await walletService.createUserAndWallet();
      const dseq = faker.string.numeric();

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
      const result = await response.json();
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

    it("should return 404 when updating other user's deployment settings", async () => {
      const [{ user: user1 }, { token: token2 }] = await Promise.all([walletService.createUserAndWallet(), walletService.createUserAndWallet()]);

      const dseq = faker.string.numeric();
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
        message: "Deployment setting not found"
      });
    });

    it("should update deployment settings", async () => {
      const { token, user, wallet } = await walletService.createUserAndWallet();
      const dseq = faker.string.numeric();

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
      const result = await response.json();
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
});
