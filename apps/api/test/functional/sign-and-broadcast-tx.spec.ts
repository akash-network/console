import { certificateManager } from "@akashnetwork/akashjs/build/certificates/certificate-manager";
import type { Registry } from "@cosmjs/proto-signing";
import { WalletService } from "@test/services/wallet.service";
import { container } from "tsyringe";

import { app } from "@src/app";
import { USER_WALLET_SCHEMA, UserWalletSchema } from "@src/billing/providers";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { ApiPgDatabase, POSTGRES_DB } from "@src/core";
import { USER_SCHEMA, UserSchema } from "@src/user/providers";

jest.setTimeout(30000);

describe("Tx Sign", () => {
  const registry = container.resolve<Registry>(TYPE_REGISTRY);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const userWalletSchema = container.resolve<UserWalletSchema>(USER_WALLET_SCHEMA);
  const userSchema = container.resolve<UserSchema>(USER_SCHEMA);
  const walletService = new WalletService(app);

  afterEach(async () => {
    await Promise.all([db.delete(userWalletSchema), db.delete(userSchema)]);
  });

  describe("POST /v1/tx", () => {
    it("should create a wallet for a user", async () => {
      const { user, wallet } = await walletService.createUserAndWallet();
      const res = await app.request("/v1/tx", {
        method: "POST",
        body: await createMessagePayload(user.id, wallet.address),
        headers: new Headers({ "Content-Type": "application/json", "x-anonymous-user-id": user.id })
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
      const { data: differentUser } = await differentUserResponse.json();
      const res = await app.request("/v1/tx", {
        method: "POST",
        body: await createMessagePayload(user.id, wallet.address),
        headers: new Headers({ "Content-Type": "application/json", "x-anonymous-user-id": differentUser.id })
      });

      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: "NotFoundError", message: "UserWallet Not Found" });
    });
  });

  async function createMessagePayload(userId: string, address: string) {
    const { cert, publicKey } = certificateManager.generatePEM(address);

    const message = {
      typeUrl: "/akash.cert.v1beta3.MsgCreateCertificate",
      value: {
        owner: address,
        cert: Buffer.from(cert).toString("base64"),
        pubkey: Buffer.from(publicKey).toString("base64")
      }
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
