import { BlockHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { NotFound } from "http-errors";
import nock from "nock";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";

import { app } from "@src/app";
import { ApiKeyOutput } from "@src/auth/repositories/api-key/api-key.repository";
import { AbilityService } from "@src/auth/services/ability/ability.service";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services";
import { DeploymentService } from "@src/deployment/services/deployment/deployment.service";
import { RestAkashDeploymentInfoResponse } from "@src/types/rest";
import { UserOutput, UserRepository } from "@src/user/repositories";
import { apiNodeUrl, betaTypeVersion, betaTypeVersionMarket } from "@src/utils/constants";

import { ApiKeySeeder } from "@test/seeders/api-key.seeder";
import { DeploymentInfoSeeder } from "@test/seeders/deployment-info.seeder";
import { UserSeeder } from "@test/seeders/user.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

jest.setTimeout(20000);

describe("Deployments API", () => {
  const userRepository = container.resolve(UserRepository);
  const apiKeyAuthService = container.resolve(ApiKeyAuthService);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const abilityService = container.resolve(AbilityService);
  const blockHttpService = container.resolve(BlockHttpService);
  const signerService = container.resolve(ManagedSignerService);
  const deploymentService = container.resolve(DeploymentService);

  let knownUsers: Record<string, UserOutput>;
  let knownApiKeys: Record<string, ApiKeyOutput>;
  let knownWallets: Record<string, UserWalletOutput[]>;
  let currentHeight: number;

  beforeEach(() => {
    knownUsers = {};
    knownApiKeys = {};
    knownWallets = {};
    currentHeight = faker.number.int({ min: 1000000, max: 10000000 });

    jest.spyOn(userRepository, "findById").mockImplementation(async (id: string) => {
      return Promise.resolve(
        knownUsers[id]
          ? {
              ...knownUsers[id],
              trial: false,
              userWallets: { isTrialing: false }
            }
          : undefined
      );
    });

    jest.spyOn(apiKeyAuthService, "getAndValidateApiKeyFromHeader").mockImplementation(async (key: string) => {
      return Promise.resolve(knownApiKeys[key]);
    });

    jest.spyOn(blockHttpService, "getCurrentHeight").mockResolvedValue(currentHeight);

    const fakeWalletRepository = {
      findByUserId: async (id: string) => {
        return Promise.resolve(knownWallets[id]);
      },
      findOneByUserId: async (id: string) => {
        return Promise.resolve(knownWallets[id]);
      }
    } as unknown as UserWalletRepository;

    jest.spyOn(userWalletRepository, "accessibleBy").mockReturnValue(fakeWalletRepository);

    jest.spyOn(signerService, "executeDecodedTxByUserId").mockResolvedValue({
      code: 200,
      transactionHash: "fake-transaction-hash",
      rawLog: "fake-raw-log"
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    nock.cleanAll();
  });

  async function mockUser() {
    const userId = faker.string.uuid();
    const userApiKeySecret = faker.word.noun();
    const user = UserSeeder.create({ userId });
    const apiKey = ApiKeySeeder.create({ userId });
    const wallets = [UserWalletSeeder.create({ userId })];

    knownUsers[userId] = user;
    knownApiKeys[userApiKeySecret] = apiKey;
    knownWallets[user.id] = wallets;

    return { user, userApiKeySecret, wallets };
  }

  async function mockAdmin() {
    const adminId = faker.string.uuid();
    const adminApiKeySecret = faker.word.noun();
    const adminUser = UserSeeder.create({ userId: adminId });
    const apiKeyForAdmin = ApiKeySeeder.create({ userId: adminId });

    knownUsers[adminId] = adminUser;
    knownApiKeys[adminApiKeySecret] = apiKeyForAdmin;

    const originalGetAbilityFor = abilityService.getAbilityFor.bind(abilityService);
    jest.spyOn(abilityService, "getAbilityFor").mockImplementation((role, user) => {
      if (user.userId === adminId) {
        return originalGetAbilityFor("SUPER_USER", user);
      }

      return originalGetAbilityFor(role, user);
    });

    return { adminApiKeySecret };
  }

  function setupDeploymentInfoMock(wallets: UserWalletOutput[], dseq: string, deploymentInfo?: RestAkashDeploymentInfoResponse) {
    const address = wallets[0].address;
    const defaultDeploymentInfo =
      deploymentInfo ||
      DeploymentInfoSeeder.create({
        owner: address,
        dseq
      });

    nock(apiNodeUrl)
      .persist()
      .get(`/akash/deployment/${betaTypeVersion}/deployments/info?id.owner=${address}&id.dseq=${dseq}`)
      .reply(200, defaultDeploymentInfo);

    nock(apiNodeUrl)
      .persist()
      .get(`/akash/market/${betaTypeVersionMarket}/leases/list?filters.owner=${address}&filters.dseq=${dseq}`)
      .reply(200, {
        leases: [
          {
            lease: "fake-lease-1"
          },
          {
            lease: "fake-lease-2"
          }
        ]
      });

    return defaultDeploymentInfo;
  }

  describe("GET /v1/deployments", () => {
    it("returns deployment by dseq", async () => {
      const dseq = "1234";
      const { userApiKeySecret, wallets } = await mockUser();
      setupDeploymentInfoMock(wallets, dseq);

      const response = await app.request(`/v1/deployments?dseq=${dseq}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toEqual({
        deployment: expect.any(Object),
        leases: ["fake-lease-1", "fake-lease-2"],
        escrow_account: expect.any(Object)
      });
    });

    it("returns deployment by dseq and userId", async () => {
      const dseq = "1234";
      const { user, userApiKeySecret, wallets } = await mockUser();
      setupDeploymentInfoMock(wallets, dseq);

      const response = await app.request(`/v1/deployments?dseq=${dseq}&userId=${user.id}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toEqual({
        deployment: expect.any(Object),
        leases: ["fake-lease-1", "fake-lease-2"],
        escrow_account: expect.any(Object)
      });
    });

    it("returns deployment by dseq and userId, any user for an admin", async () => {
      const dseq = "1234";
      const { user, wallets } = await mockUser();
      const { adminApiKeySecret } = await mockAdmin();
      setupDeploymentInfoMock(wallets, dseq);

      const response = await app.request(`/v1/deployments?dseq=${dseq}&userId=${user.id}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": adminApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toEqual({
        deployment: expect.any(Object),
        leases: ["fake-lease-1", "fake-lease-2"],
        escrow_account: expect.any(Object)
      });
    });

    it("returns 404 for an error in deployment info", async () => {
      const dseq = "1234";
      const { user, wallets } = await mockUser();
      const { adminApiKeySecret } = await mockAdmin();
      setupDeploymentInfoMock(wallets, dseq, DeploymentInfoSeeder.createError());

      const response = await app.request(`/v1/deployments?dseq=${dseq}&userId=${user.id}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": adminApiKeySecret })
      });

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result).toEqual({
        error: "NotFoundError",
        message: "Deployment not found"
      });
    });

    it("returns 500 for an error in deployment info", async () => {
      const dseq = "1234";
      const { user, wallets } = await mockUser();
      const { adminApiKeySecret } = await mockAdmin();
      setupDeploymentInfoMock(
        wallets,
        dseq,
        DeploymentInfoSeeder.createError({
          code: 987,
          message: "Some kind of error"
        })
      );

      const response = await app.request(`/v1/deployments?dseq=${dseq}&userId=${user.id}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": adminApiKeySecret })
      });

      expect(response.status).toBe(500);
      const result = await response.json();
      expect(result).toEqual({
        error: "InternalServerError",
        message: "Some kind of error"
      });
    });

    it("returns 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deployments?dseq=1234", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
    });

    it("returns 400 if no dseq set", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      setupDeploymentInfoMock(wallets, "1234");

      const response = await app.request("/v1/deployments", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /v1/deployments", () => {
    it("creates a deployment", async () => {
      const { userApiKeySecret } = await mockUser();
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: yml,
            deposit: 5.5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.data).toEqual({
        dseq: expect.any(String),
        manifest: expect.any(String),
        signTx: {
          code: 200,
          transactionHash: expect.any(String),
          rawLog: expect.any(String)
        }
      });
    });

    it("returns 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: "",
            deposit: 5.5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
    });

    it("returns 400 for an SDL invalid in a meaningful way", async () => {
      const { userApiKeySecret } = await mockUser();
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/invalid-sdl.yml"), "utf8");

      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: yml,
            deposit: 5.5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.message).toContain("Invalid SDL");
    });

    it("returns 400 if the SDL sent is invalid", async () => {
      const { userApiKeySecret } = await mockUser();

      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: "invalid-sdl",
            deposit: 5.5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.message).toContain("Invalid SDL");
    });

    it("returns 400 if deposit is missing", async () => {
      const { userApiKeySecret } = await mockUser();
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: yml
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /v1/deployments/{dseq}", () => {
    it("should close a deployment successfully", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const dseq = "1234";
      setupDeploymentInfoMock(wallets, dseq);

      const mockTxResult = {
        code: 0,
        hash: "test-hash",
        rawLog: "success"
      };

      jest.spyOn(signerService, "executeDecodedTxByUserId").mockResolvedValueOnce(mockTxResult);

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "DELETE",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toEqual({
        data: {
          success: true
        }
      });
    });

    it("should return 404 if deployment does not exist", async () => {
      const { userApiKeySecret } = await mockUser();
      const dseq = "1234";

      jest.spyOn(deploymentService, "findByOwnerAndDseq").mockRejectedValueOnce(new NotFound("Deployment not found"));

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "DELETE",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result).toEqual({
        error: "NotFoundError",
        message: "Deployment not found"
      });
    });

    it("should return 500 if transaction fails", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const dseq = "1234";
      setupDeploymentInfoMock(wallets, dseq);

      jest.spyOn(signerService, "executeDecodedTxByUserId").mockRejectedValueOnce(new Error("Failed to sign and broadcast tx"));

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "DELETE",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(500);
      const result = await response.json();
      expect(result).toEqual({
        error: "InternalServerError"
      });
    });

    it("should return 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deployments/1234", {
        method: "DELETE",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result).toEqual({
        error: "UnauthorizedError",
        message: "Unauthorized"
      });
    });
  });

  describe("POST /v1/deployments/{dseq}/deposit", () => {
    it("should deposit into a deployment successfully", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const dseq = "1234";
      setupDeploymentInfoMock(wallets, dseq);

      const mockTxResult = {
        code: 0,
        hash: "test-hash",
        rawLog: "success"
      };

      jest.spyOn(signerService, "executeDecodedTxByUserId").mockResolvedValueOnce(mockTxResult);

      const response = await app.request(`/v1/deployments/${dseq}/deposit`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            deposit: 5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
    });

    it("should return 404 if deployment does not exist", async () => {
      const { userApiKeySecret } = await mockUser();
      const dseq = "1234";

      jest.spyOn(deploymentService, "findByOwnerAndDseq").mockRejectedValueOnce(new NotFound("Deployment not found"));

      const response = await app.request(`/v1/deployments/${dseq}/deposit`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            deposit: 5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result).toEqual({
        error: "NotFoundError",
        message: "Deployment not found"
      });
    });

    it("should return 500 if transaction fails", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const dseq = "1234";
      setupDeploymentInfoMock(wallets, dseq);

      jest.spyOn(signerService, "executeDecodedTxByUserId").mockRejectedValueOnce(new Error("Failed to sign and broadcast tx"));

      const response = await app.request(`/v1/deployments/${dseq}/deposit`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            deposit: 5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(500);
      const result = await response.json();
      expect(result).toEqual({
        error: "InternalServerError"
      });
    });

    it("should return 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deployments/1234/deposit", {
        method: "POST",
        body: JSON.stringify({
          data: {
            deposit: 5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result).toEqual({
        error: "UnauthorizedError",
        message: "Unauthorized"
      });
    });

    it("should return 400 if deposit amount is not provided", async () => {
      const { userApiKeySecret } = await mockUser();
      const dseq = "1234";

      const response = await app.request(`/v1/deployments/${dseq}/deposit`, {
        method: "POST",
        body: JSON.stringify({
          data: {}
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });
  });
});
