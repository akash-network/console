import { BlockHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { NotFound } from "http-errors";
import nock from "nock";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";

import { app } from "@src/app";
import type { ApiKeyOutput } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import type { UserWalletOutput } from "@src/billing/repositories";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services";
import { DeploymentService } from "@src/deployment/services/deployment/deployment.service";
import { ProviderService } from "@src/deployment/services/provider/provider.service";
import type { RestAkashDeploymentInfoResponse } from "@src/types/rest";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { apiNodeUrl, betaTypeVersion, betaTypeVersionMarket } from "@src/utils/constants";

import { ApiKeySeeder } from "@test/seeders/api-key.seeder";
import { DeploymentInfoSeeder } from "@test/seeders/deployment-info.seeder";
import { LeaseSeeder } from "@test/seeders/lease.seeder";
import { LeaseStatusSeeder } from "@test/seeders/lease-status.seeder";
import { UserSeeder } from "@test/seeders/user.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

jest.setTimeout(20000);

describe("Deployments API", () => {
  const userRepository = container.resolve(UserRepository);
  const apiKeyAuthService = container.resolve(ApiKeyAuthService);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const providerService = container.resolve(ProviderService);
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
        return Promise.resolve(knownWallets[id][0]);
      }
    } as unknown as UserWalletRepository;

    jest.spyOn(userWalletRepository, "accessibleBy").mockReturnValue(fakeWalletRepository);

    jest.spyOn(signerService, "executeDecodedTxByUserId").mockResolvedValue({
      code: 200,
      transactionHash: "fake-transaction-hash",
      rawLog: "fake-raw-log"
    });

    jest.spyOn(providerService, "sendManifest").mockResolvedValue(true);
    jest.spyOn(providerService, "getLeaseStatus").mockResolvedValue(LeaseStatusSeeder.create());
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
      .get(`/akash/deployment/${betaTypeVersion}/deployments/list?filters.owner=${address}`)
      .reply(200, {
        deployments: [defaultDeploymentInfo]
      });

    nock(apiNodeUrl)
      .persist()
      .get(`/akash/deployment/${betaTypeVersion}/deployments/info?id.owner=${address}&id.dseq=${dseq}`)
      .reply(200, defaultDeploymentInfo);

    const leases = LeaseSeeder.createMany(2, {
      owner: address,
      dseq,
      state: "active"
    });

    nock(apiNodeUrl).persist().get(`/akash/market/${betaTypeVersionMarket}/leases/list?filters.owner=${address}&filters.dseq=${dseq}`).reply(200, { leases });

    return defaultDeploymentInfo;
  }

  function setupDeploymentListMock(wallets: UserWalletOutput[], count: number = 2, state: string = "active") {
    const address = wallets[0].address;
    const deployments: RestAkashDeploymentInfoResponse[] = [];

    for (let i = 0; i < count; i++) {
      const dseq = faker.string.numeric();
      const deploymentInfo = DeploymentInfoSeeder.create({
        owner: address,
        dseq,
        state
      });

      deployments.push(deploymentInfo);

      nock(apiNodeUrl).get(`/akash/deployment/${betaTypeVersion}/deployments/info?id.owner=${address}&id.dseq=${dseq}`).reply(200, deploymentInfo);

      const leases = LeaseSeeder.createMany(2, {
        owner: address,
        dseq,
        state: "active"
      });

      nock(apiNodeUrl).get(`/akash/market/${betaTypeVersionMarket}/leases/list?filters.owner=${address}&filters.dseq=${dseq}`).reply(200, { leases });
    }

    return deployments;
  }

  describe("GET /v1/deployments", () => {
    it("returns deployment by dseq", async () => {
      const dseq = "1234";
      const { userApiKeySecret, wallets } = await mockUser();
      setupDeploymentInfoMock(wallets, dseq);

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toEqual({
        deployment: expect.any(Object),
        escrow_account: expect.any(Object),
        leases: expect.arrayContaining([expect.any(Object)])
      });
    });

    it("returns 404 for an error in deployment info", async () => {
      const dseq = "1234";
      const { userApiKeySecret, wallets } = await mockUser();
      setupDeploymentInfoMock(wallets, dseq, DeploymentInfoSeeder.createError());

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result).toEqual({
        error: "NotFoundError",
        message: "Deployment not found"
      });
    });

    it("returns 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deployments/1234", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
    });

    it("returns all deployments when skip and limit are not provided", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const deployments = setupDeploymentListMock(wallets, 2);

      nock(apiNodeUrl)
        .persist()
        .get(/\/akash\/deployment\/v1beta3\/deployments\/list\?.*/)
        .reply(200, {
          deployments,
          pagination: {
            total: deployments.length,
            next_key: null
          }
        });

      const response = await app.request("/v1/deployments", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toEqual({
        deployments: expect.arrayContaining([
          expect.objectContaining({
            deployment: expect.any(Object),
            escrow_account: expect.any(Object),
            leases: expect.arrayContaining([expect.any(Object)])
          })
        ]),
        pagination: {
          total: expect.any(Number),
          skip: 0,
          limit: expect.any(Number),
          hasMore: false
        }
      });
    });

    it("returns paginated list of deployments when skip and limit are provided", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const deployments = setupDeploymentListMock(wallets, 2, "active");

      nock(apiNodeUrl)
        .persist()
        .get(/\/akash\/deployment\/v1beta3\/deployments\/list\?.*/)
        .reply(200, {
          deployments: deployments.slice(0, 1),
          pagination: {
            total: deployments.length,
            next_key: null
          }
        });

      const response = await app.request("/v1/deployments?skip=0&limit=1", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toEqual({
        deployments: expect.arrayContaining([
          expect.objectContaining({
            deployment: expect.any(Object),
            escrow_account: expect.any(Object),
            leases: expect.arrayContaining([expect.any(Object)])
          })
        ]),
        pagination: {
          total: expect.any(Number),
          skip: 0,
          limit: 1,
          hasMore: true
        }
      });
      expect(result.data.deployments).toHaveLength(1);
    });

    it("returns 400 if skip is negative", async () => {
      const { userApiKeySecret } = await mockUser();

      const response = await app.request("/v1/deployments?skip=-1&limit=10", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 if limit is less than 1", async () => {
      const { userApiKeySecret } = await mockUser();

      const response = await app.request("/v1/deployments?skip=0&limit=0", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });

    it("filters deployments by status", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const deployments = setupDeploymentListMock(wallets, 1, "active");

      nock(apiNodeUrl)
        .persist()
        .get(/\/akash\/deployment\/v1beta3\/deployments\/list\?.*/)
        .reply(200, {
          deployments,
          pagination: {
            total: deployments.length,
            next_key: null
          }
        });

      const response = await app.request("/v1/deployments?status=active", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data.deployments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            deployment: expect.objectContaining({
              state: "active"
            })
          })
        ])
      );
    });

    it("returns 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deployments", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
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

      const response = await app.request(`/v1/deposit-deployment`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            dseq,
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

      const response = await app.request(`/v1/deposit-deployment`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            dseq,
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

    it("should return 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deposit-deployment", {
        method: "POST",
        body: JSON.stringify({
          data: {
            dseq: "1234",
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

      const response = await app.request(`/v1/deposit-deployment`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            dseq
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /v1/deployments/{dseq}", () => {
    it("should update a deployment successfully", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const dseq = "1234";
      setupDeploymentInfoMock(wallets, dseq);

      const mockTxResult = {
        code: 0,
        hash: "test-hash",
        rawLog: "success"
      };

      jest.spyOn(signerService, "executeDecodedTxByUserId").mockResolvedValueOnce(mockTxResult);

      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "PUT",
        body: JSON.stringify({
          data: {
            sdl: yml,
            certificate: {
              certPem: "test-cert-pem",
              keyPem: "test-key-pem"
            }
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toEqual({
        deployment: expect.any(Object),
        escrow_account: expect.any(Object),
        leases: expect.arrayContaining([expect.any(Object)])
      });
    });

    it("should return 404 if deployment does not exist", async () => {
      const { userApiKeySecret } = await mockUser();
      const dseq = "1234";

      jest.spyOn(deploymentService, "findByOwnerAndDseq").mockRejectedValueOnce(new NotFound("Deployment not found"));

      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "PUT",
        body: JSON.stringify({
          data: {
            sdl: yml,
            certificate: {
              certPem: "test-cert-pem",
              keyPem: "test-key-pem"
            }
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

    it("should return 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deployments/1234", {
        method: "PUT",
        body: JSON.stringify({
          data: {
            sdl: "test-sdl",
            certificate: {
              certPem: "test-cert-pem",
              keyPem: "test-key-pem"
            }
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

    it("should return 400 if SDL is invalid", async () => {
      const { userApiKeySecret } = await mockUser();
      const dseq = "1234";

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "PUT",
        body: JSON.stringify({
          data: {
            sdl: "invalid-sdl",
            certificate: {
              certPem: "test-cert-pem",
              keyPem: "test-key-pem"
            }
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.message).toContain("Invalid SDL");
    });

    it("should return 400 if certificate is missing required fields", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const dseq = "1234";
      setupDeploymentInfoMock(wallets, dseq);

      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "PUT",
        body: JSON.stringify({
          data: {
            sdl: yml,
            certificate: {
              certPem: "test-cert-pem"
            }
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result).toEqual({
        data: [
          {
            code: "invalid_type",
            expected: "string",
            message: "Required",
            path: ["data", "certificate", "keyPem"],
            received: "undefined"
          }
        ],
        error: "BadRequestError"
      });
    });
  });
});
