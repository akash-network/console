import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { FeeAllowancesResponse, WalletBalancesResponse } from "@src/billing/http-schemas/balance.schema";
import { UserWalletRepository } from "@src/billing/repositories";
import { CORE_CONFIG } from "@src/core";
import type { GetDeploymentInfoResponse } from "@src/deployment/http-schemas/deployment-rpc.schema";
import type { ListLeasesResponse } from "@src/deployment/http-schemas/lease.schema";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { fileIntoPersonalOrganization } from "@test/seeders/db/organization.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createFeeAllowanceResponse } from "@test/seeders/fee-allowance-response.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";

describe("Wallet chain reads", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);
  const userWalletRepository = container.resolve(UserWalletRepository);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("GET /v1/wallet-balances", () => {
    it("refuses an anonymous caller", async () => {
      const response = await app.request("/v1/wallet-balances");

      expect(response.status).toBe(401);
    });

    it("returns the current wallet's balances, grants and escrowed deployments", async () => {
      const { token, address } = await setup();
      const deployment = createDeploymentInfoSeed({ owner: address, dseq: "4242", denom: "uact", amount: "300.5" });
      deployment.escrow_account.state.settled_at = "1000";
      chain()
        .get(uri => uri.startsWith(`/cosmos/bank/v1beta1/balances/${address}`))
        .reply(200, { balances: [{ denom: "uact", amount: "1200" }], pagination: { next_key: null, total: "1" } })
        .get(uri => uri.startsWith(`/cosmos/authz/v1beta1/grants/grantee/${address}`))
        .reply(200, {
          grants: [
            {
              granter: createAkashAddress(),
              grantee: address,
              authorization: { "@type": "/akash.escrow.v1.DepositAuthorization", spend_limits: [{ denom: "uact", amount: "500" }] },
              expiration: faker.date.future().toISOString()
            }
          ],
          pagination: { next_key: null, total: "1" }
        })
        .get(uri => uri.startsWith("/akash/deployment/v1beta4/deployments/list") && uri.includes(address) && uri.includes("filters.state=active"))
        .reply(200, { deployments: [deployment], pagination: { next_key: null, total: "1" } });

      const response = await app.request("/v1/wallet-balances", { headers: { authorization: `Bearer ${token}` } });

      expect(response.status).toBe(200);
      expect((await response.json()) as WalletBalancesResponse).toEqual({
        data: {
          balances: [{ denom: "uact", amount: "1200" }],
          deploymentGrants: [{ denom: "uact", amount: "500" }],
          activeDeployments: [{ dseq: "4242", escrow: { funds: [{ denom: "uact", amount: "300.5" }], settledAt: 1000 } }]
        }
      });
    });
  });

  describe("GET /v1/fee-allowances", () => {
    it("refuses an anonymous caller", async () => {
      const response = await app.request("/v1/fee-allowances");

      expect(response.status).toBe(401);
    });

    it("lists the unexpired fee allowances granted to the current wallet", async () => {
      const { token, address } = await setup();
      const valid = createFeeAllowanceResponse({ grantee: address, amount: "250" }).allowance;
      const expired = createFeeAllowanceResponse({ grantee: address }).allowance;
      expired.allowance.expiration = faker.date.past().toISOString();
      chain()
        .get(`/cosmos/feegrant/v1beta1/allowances/${address}`)
        .reply(200, { allowances: [valid, expired] });

      const response = await app.request("/v1/fee-allowances", { headers: { authorization: `Bearer ${token}` } });

      expect(response.status).toBe(200);
      expect((await response.json()) as FeeAllowancesResponse).toEqual({
        data: [{ granter: valid.granter, spendLimit: [{ denom: "uakt", amount: "250" }], expiration: valid.allowance.expiration }]
      });
    });
  });

  describe("GET /v1/leases", () => {
    it("refuses an anonymous caller", async () => {
      const response = await app.request("/v1/leases");

      expect(response.status).toBe(401);
    });

    it("lists the current wallet's leases filtered by deployment and provider", async () => {
      const { token, address } = await setup();
      const provider = createAkashAddress();
      const lease = createLeaseApiResponse({ owner: address, dseq: "77", provider, state: "active" });
      chain()
        .get("/akash/market/v1beta5/leases/list")
        .query({ "filters.owner": address, "filters.dseq": "77", "filters.provider": provider, "pagination.limit": "5" })
        .reply(200, { leases: [lease], pagination: { next_key: null, total: "1" } });

      const response = await app.request(`/v1/leases?dseq=77&provider=${provider}&limit=5`, { headers: { authorization: `Bearer ${token}` } });

      expect(response.status).toBe(200);
      expect((await response.json()) as ListLeasesResponse).toEqual({ data: [lease.lease] });
    });

    it("joins one chain page per repeated state", async () => {
      const { token, address } = await setup();
      const active = createLeaseApiResponse({ owner: address, state: "active" });
      const reclaiming = createLeaseApiResponse({ owner: address, state: "reclaiming" });
      chain()
        .get("/akash/market/v1beta5/leases/list")
        .query(query => query["filters.state"] === "active")
        .reply(200, { leases: [active], pagination: { next_key: null, total: "1" } })
        .get("/akash/market/v1beta5/leases/list")
        .query(query => query["filters.state"] === "reclaiming")
        .reply(200, { leases: [reclaiming], pagination: { next_key: null, total: "1" } });

      const response = await app.request("/v1/leases?state=active&state=reclaiming", { headers: { authorization: `Bearer ${token}` } });

      expect(response.status).toBe(200);
      expect(((await response.json()) as ListLeasesResponse).data).toEqual([active.lease, reclaiming.lease]);
    });

    it("refuses a state the chain does not know", async () => {
      const { token } = await setup();

      const response = await app.request("/v1/leases?state=paused", { headers: { authorization: `Bearer ${token}` } });

      expect(response.status).toBe(400);
    });

    it("refuses a limit above the page cap", async () => {
      const { token } = await setup();

      const response = await app.request("/v1/leases?limit=1001", { headers: { authorization: `Bearer ${token}` } });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/deployments/{dseq}/info", () => {
    it("refuses an anonymous caller", async () => {
      const response = await app.request("/v1/deployments/123/info");

      expect(response.status).toBe(401);
    });

    it("returns the current wallet's deployment as the chain holds it", async () => {
      const { token, address } = await setup();
      const deployment = createDeploymentInfoSeed({ owner: address, dseq: "123" });
      chain().get("/akash/deployment/v1beta4/deployments/info").query({ "id.owner": address, "id.dseq": "123" }).reply(200, deployment);

      const response = await app.request("/v1/deployments/123/info", { headers: { authorization: `Bearer ${token}` } });

      expect(response.status).toBe(200);
      expect((await response.json()) as GetDeploymentInfoResponse).toEqual({ data: deployment });
    });

    it("answers not found for a deployment the chain does not hold", async () => {
      const { token, address } = await setup();
      chain()
        .get("/akash/deployment/v1beta4/deployments/info")
        .query({ "id.owner": address, "id.dseq": "123" })
        .reply(404, { code: 5, message: "deployment not found", details: [] });

      const response = await app.request("/v1/deployments/123/info", { headers: { authorization: `Bearer ${token}` } });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ message: "Deployment not found" });
    });
  });

  describe("GET /v1/blockchain-status", () => {
    it("reports the chain reachable at its latest height", async () => {
      chain()
        .get("/cosmos/base/tendermint/v1beta1/blocks/latest")
        .reply(200, { block: { header: { height: "1234567" } } });

      const response = await app.request("/v1/blockchain-status");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ isBlockchainReachable: true, latestBlockHeight: 1234567 });
    });
  });

  function chain() {
    return nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL);
  }

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const token = faker.string.alphanumeric(40);
    const address = createAkashAddress();
    const { wallet } = await userWalletRepository.getOrCreate({ userId: user.id });
    await userWalletRepository.updateById(wallet.id, { address });

    await fileIntoPersonalOrganization(user);
    vi.spyOn(userAuthTokenService, "getValidUserId").mockResolvedValue(user.userId);

    return { token, address };
  }
});
