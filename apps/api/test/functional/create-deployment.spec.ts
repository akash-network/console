import { certificateManager } from "@akashnetwork/chain-sdk";
import { SDL } from "@akashnetwork/chain-sdk";
import { Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { BlockHttpService } from "@akashnetwork/http-sdk";
import type { Registry } from "@cosmjs/proto-signing";
import nock from "nock";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";

import { BILLING_CONFIG } from "@src/billing/providers";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { CORE_CONFIG } from "@src/core";
import { app } from "@src/rest-app";
import { certVersion, deploymentVersion } from "@src/utils/constants";

import { topUpWallet } from "@test/services/topUpWallet";
import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(30000);

const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

// TODO: finish this test to create a lease and then close the deployment
describe("Tx Sign", () => {
  const registry = container.resolve<Registry>(TYPE_REGISTRY);
  const walletService = new WalletTestingService(app);

  beforeAll(async () => {
    await topUpWallet({ minAmount: 5_100_000 });
  });

  afterEach(async () => {
    nock.cleanAll();
  });

  describe("POST /v1/tx", () => {
    it("should create a deployment for a user", async () => {
      const { user, token, wallet } = await walletService.createUserAndWallet();
      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL, { allowUnmocked: true })
        .get(
          `/akash/deployment/${deploymentVersion}/deployments/list?filters.owner=${wallet.address}&pagination.offset=0&pagination.limit=1&pagination.count_total=true&pagination.reverse=false`
        )
        .reply(200, {
          deployments: [],
          pagination: {
            total: 1
          }
        })
        .get("/cosmos/base/tendermint/v1beta1/blocks/latest")
        .reply(200, {
          block: {
            header: {
              height: Math.floor(Math.random() * 1000000).toString()
            }
          }
        });

      const res = await app.request("/v1/tx", {
        method: "POST",
        body: await createMessagePayload(user.id, wallet.address),
        headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${token}` })
      });
      const result = await res.json();

      expect(res.status).toBe(200);
      expect(result).toMatchObject({ data: { code: 0, transactionHash: expect.any(String), hash: expect.any(String) } });
    });
  });

  async function createMessagePayload(userId: string, address: string) {
    const { cert, publicKey } = await certificateManager.generatePEM(address);

    const sdl = SDL.fromString(yml, "beta3", "sandbox");
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
          groups: sdl.groups(),
          hash: await sdl.manifestVersion(),
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
});
