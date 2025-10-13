import { certificateManager } from "@akashnetwork/chain-sdk";
import { SDL } from "@akashnetwork/chain-sdk";
import { Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { Registry } from "@cosmjs/proto-signing";
import axios from "axios";
import nock from "nock";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";

import { config } from "@src/billing/config";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import { apiNodeUrl, certVersion, deploymentVersion } from "@src/utils/constants";

import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(30000);

const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

// TODO: finish this test to create a lease and then close the deployment
describe("Tx Sign", () => {
  const registry = container.resolve<Registry>(TYPE_REGISTRY);
  const walletService = new WalletTestingService(app);

  afterEach(async () => {
    nock.cleanAll();
  });

  describe("POST /v1/tx", () => {
    it("should create a deployment for a user", async () => {
      jest.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag !== FeatureFlags.ANONYMOUS_FREE_TRIAL);

      const { user, token, wallet } = await walletService.createUserAndWallet();
      nock(apiNodeUrl, { allowUnmocked: true })
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
    const currentHeight = await getCurrentHeight();

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
          deposit: { amount: { denom: config.DEPLOYMENT_GRANT_DENOM, amount: "5000000" }, sources: [Source.grant] }
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

  async function getCurrentHeight() {
    const response = await axios.get(`${apiNodeUrl}/cosmos/base/tendermint/v1beta1/blocks/latest`);
    const height = parseInt(response.data.block.header.height);

    if (isNaN(height)) throw new Error("Failed to get current height");

    return height;
  }
});
