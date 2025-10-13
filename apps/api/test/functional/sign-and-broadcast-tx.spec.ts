import { certificateManager } from "@akashnetwork/chain-sdk";
import { MsgCreateCertificate } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { Registry } from "@cosmjs/proto-signing";
import { container } from "tsyringe";

import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { app } from "@src/rest-app";

import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(30000);

describe("Tx Sign", () => {
  const registry = container.resolve<Registry>(TYPE_REGISTRY);
  const walletService = new WalletTestingService(app);

  describe("POST /v1/tx", () => {
    it("should create a wallet for a user", async () => {
      const { user, token, wallet } = await walletService.createUserAndWallet();
      const res = await app.request("/v1/tx", {
        method: "POST",
        body: await createMessagePayload(user.id, wallet.address),
        headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${token}` })
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ data: { code: 0, transactionHash: expect.any(String) } });
    });

    it("should throw 401 provided no auth header", async () => {
      const { user, wallet } = await walletService.createUserAndWallet();
      const res = await app.request("/v1/tx", {
        method: "POST",
        body: await createMessagePayload(user.id, wallet.address),
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: "UnauthorizedError", message: "Unauthorized" });
    });

    it("should throw 404 provided a different user auth header", async () => {
      const { user, wallet } = await walletService.createUserAndWallet();
      const differentUserResponse = await app.request("/v1/anonymous-users", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const { token } = (await differentUserResponse.json()) as any;
      const res = await app.request("/v1/tx", {
        method: "POST",
        body: await createMessagePayload(user.id, wallet.address),
        headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${token}` })
      });

      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: "NotFoundError", message: "UserWallet Not Found" });
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
});
