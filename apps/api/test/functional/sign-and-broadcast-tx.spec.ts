import { certificateManager, generateManifest, generateManifestVersion, yaml } from "@akashnetwork/chain-sdk";
import { MsgCreateCertificate, Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { BlockHttpService } from "@akashnetwork/http-sdk";
import type { Registry } from "@cosmjs/proto-signing";
import nock from "nock";
import fs from "node:fs";
import path from "node:path";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BILLING_CONFIG } from "@src/billing/providers";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { CORE_CONFIG } from "@src/core";
import { app } from "@src/rest-app";
import { certVersion, deploymentVersion } from "@src/utils/constants";

import { DeploymentGrantResponseSeeder } from "@test/seeders/deployment-grant-response.seeder";
import { DeploymentListResponseSeeder } from "@test/seeders/deployment-list-response.seeder";
import { FeeAllowanceResponseSeeder } from "@test/seeders/fee-allowance-response.seeder";
import { WalletTestingService } from "@test/services/wallet-testing.service";

describe("Tx Sign", () => {
  const registry = container.resolve<Registry>(TYPE_REGISTRY);
  const walletService = new WalletTestingService(app);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("POST /v1/tx", () => {
    it("creates a deployment for a user", async () => {
      const { user, token, wallet } = await setup({
        deploymentAllowance: 1_000_000
      });

      const res = await app.request("/v1/tx", {
        method: "POST",
        body: await createMessageForDeployment(user.id, wallet.address),
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` }
      });
      const result = await res.json();

      expect(res.status).toBe(200);
      expect(result).toMatchObject({ data: { code: 0, transactionHash: expect.any(String), hash: expect.any(String) } });
    });

    it("creates blockchain transaction", async () => {
      const { user, token, wallet } = await setup({
        deploymentAllowance: 1_000_000
      });
      const res = await app.request("/v1/tx", {
        method: "POST",
        body: await createMessagePayload(user.id, wallet.address),
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` }
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ data: { code: 0, transactionHash: expect.any(String) } });
    });

    it("responds with 401 provided no auth header", async () => {
      const { user, wallet } = await setup();
      const res = await app.request("/v1/tx", {
        method: "POST",
        body: await createMessagePayload(user.id, wallet.address),
        headers: { "Content-Type": "application/json" }
      });

      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: "UnauthorizedError", message: "Unauthorized" });
    });

    it("responds with 404 provided a different user auth header", async () => {
      const { user, wallet } = await setup();
      const { token: differentUserToken } = await walletService.createRegisteredUser();
      const res = await app.request("/v1/tx", {
        method: "POST",
        body: await createMessagePayload(user.id, wallet.address),
        headers: { "Content-Type": "application/json", authorization: `Bearer ${differentUserToken}` }
      });

      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: "NotFoundError", message: "UserWallet Not Found" });
    });

    it("responds with 402 Payment Required when blockchain returns insufficient balance error", async () => {
      const { user, token, wallet } = await setup({
        blockchainError: "failed to execute message; message index: 1: Deposit invalid: insufficient balance"
      });

      const res = await app.request("/v1/tx", {
        method: "POST",
        body: await createMessagePayload(user.id, wallet.address),
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` }
      });

      expect(res.status).toBe(402);
      const responseBody = await res.json();
      expect(responseBody).toMatchObject({
        error: "PaymentRequiredError",
        message: "Insufficient balance"
      });
    });
  });

  async function createMessagePayload(userId: string, address: string) {
    const { cert, publicKey } = await certificateManager.generatePEM(address);

    const message = {
      typeUrl: `/${MsgCreateCertificate.$type}`,
      value: MsgCreateCertificate.fromPartial({
        owner: address,
        cert: Buffer.from(cert),
        pubkey: Buffer.from(publicKey)
      })
    };

    return JSON.stringify({
      data: {
        userId: userId,
        messages: [
          {
            typeUrl: message.typeUrl,
            value: Buffer.from(registry.encode(message)).toString("base64")
          }
        ]
      }
    });
  }

  const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");
  async function createMessageForDeployment(userId: string, address: string) {
    const { cert, publicKey } = await certificateManager.generatePEM(address);
    const manifest = generateManifest(yaml.template(yml), "sandbox");
    if (!manifest.ok) throw new Error("Failed to generate manifest");
    const currentHeight = await container.resolve(BlockHttpService).getCurrentHeight();

    const messages = [
      {
        typeUrl: `/akash.cert.${certVersion}.MsgCreateCertificate`,
        value: {
          owner: address,
          cert: Buffer.from(cert),
          pubkey: Buffer.from(publicKey)
        }
      },
      {
        typeUrl: `/akash.deployment.${deploymentVersion}.MsgCreateDeployment`,
        value: {
          id: {
            owner: address,
            dseq: currentHeight
          },
          groups: manifest.value.groupSpecs,
          hash: await generateManifestVersion(manifest.value.groups),
          deposit: { amount: { denom: container.resolve(BILLING_CONFIG).DEPLOYMENT_GRANT_DENOM, amount: "5000000" }, sources: [Source.grant] }
        }
      }
    ];

    return JSON.stringify({
      data: {
        userId: userId,
        messages: messages.map(message => ({ typeUrl: message.typeUrl, value: Buffer.from(registry.encode(message)).toString("base64") }))
      }
    });
  }

  async function setup(input?: { deploymentAllowance?: number; blockchainError?: string }) {
    const txSignerNock = nock(container.resolve(BILLING_CONFIG).TX_SIGNER_BASE_URL);

    txSignerNock
      .post("/v1/tx/funding")
      .times(2)
      .reply(200, {
        data: {
          code: 0,
          hash: "SOME_HASH",
          rawLog: "[]"
        }
      });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .get(/\/cosmos\/feegrant\/v1beta1\/allowances\/.*/)
      .once()
      .reply(200, { allowances: [FeeAllowanceResponseSeeder.create()] });

    const { user, token, wallet } = await walletService.createUserAndWallet();

    txSignerNock
      .persist()
      .post("/v1/tx/funding")
      .reply(200, {
        data: {
          code: 0,
          hash: "SOME_HASH",
          rawLog: "[]"
        }
      });

    if (input?.blockchainError) {
      txSignerNock.persist().post("/v1/tx/derived").reply(500, {
        code: 1,
        message: input.blockchainError
      });
    } else {
      txSignerNock
        .persist()
        .post("/v1/tx/derived")
        .reply(200, {
          data: {
            code: 0,
            hash: "SOME_HASH",
            rawLog: "[]"
          }
        });
    }

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(/\/cosmos\/feegrant\/v1beta1\/allowance\/.*\/.*/)
      .reply(200, FeeAllowanceResponseSeeder.create({ grantee: wallet.address, amount: "5000000" }))
      .get(/\/cosmos\/authz\/v1beta1\/grants\?.*/)
      .reply(
        200,
        DeploymentGrantResponseSeeder.create({
          grantee: wallet.address,
          amount: input?.deploymentAllowance?.toString() ?? "0",
          grantType: "/akash.escrow.v1.DepositAuthorization"
        })
      )
      .get(/\/akash\/deployment\/.*\/deployments\/list\?.*/)
      .reply(200, DeploymentListResponseSeeder.create({ owner: wallet.address }))
      .get("/cosmos/base/tendermint/v1beta1/blocks/latest")
      .reply(200, { block: { header: { height: Math.floor(Math.random() * 1000000).toString() } } });

    return { user, token, wallet };
  }
});
