import { MsgCreateDeployment } from "@akashnetwork/akash-api/akash/deployment/v1beta4";
import { certificateManager } from "@akashnetwork/akashjs/build/certificates/certificate-manager";
import { SDL } from "@akashnetwork/akashjs/build/sdl";
import type { Registry } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import Long from "long";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";

import { app } from "@src/app";
import { config } from "@src/billing/config";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { MANAGED_MASTER_WALLET } from "@src/billing/providers/wallet.provider";
import { Wallet } from "@src/billing/services";

import { DbTestingService } from "@test/services/db-testing.service";
import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(30000);
const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

// TODO: finish this test to create a lease and then close the deployment
describe("Tx Sign", () => {
  const registry = container.resolve<Registry>(TYPE_REGISTRY);
  const walletService = new WalletTestingService(app);
  const masterWallet = container.resolve<Wallet>(MANAGED_MASTER_WALLET);
  const dbService = container.resolve(DbTestingService);

  afterEach(async () => {
    await dbService.cleanAll();
  });

  describe("POST /v1/tx", () => {
    it("should create a deployment for a user", async () => {
      const { user, token, wallet } = await walletService.createUserAndWallet();
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
    const { cert, publicKey } = certificateManager.generatePEM(address);

    const sdl = SDL.fromString(yml, "beta3", "sandbox");
    const { $type, ...message } = MsgCreateDeployment.fromPartial({
      id: {
        owner: address,
        dseq: Long.fromString(faker.number.int({ min: 0, max: 999999 }).toString(), true)
      },
      hash: await sdl.manifestVersion(),
      groups: sdl.groups(),
      deposit: { denom: config.DEPLOYMENT_GRANT_DENOM, amount: "5000000" },
      depositor: await masterWallet.getFirstAddress()
    });

    return JSON.stringify({
      data: {
        userId: userId,
        messages: [
          {
            typeUrl: "/akash.cert.v1.MsgCreateCertificate",
            value: {
              owner: address,
              cert: Buffer.from(cert),
              pubkey: Buffer.from(publicKey)
            }
          },
          {
            typeUrl: `/${$type}`,
            value: message
          }
        ].map(message => ({ typeUrl: message.typeUrl, value: Buffer.from(registry.encode(message)).toString("base64") }))
      }
    });
  }
});
