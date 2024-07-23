import { certificateManager } from "@akashnetwork/akashjs/build/certificates/certificate-manager";
import type { Registry } from "@cosmjs/proto-signing";
import { container } from "tsyringe";

import { app } from "@src/app";
import { USER_WALLET_SCHEMA, UserWalletSchema } from "@src/billing/providers";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { ApiPgDatabase, POSTGRES_DB } from "@src/core";
import { USER_SCHEMA, UserSchema } from "@src/user/providers";

jest.setTimeout(20000);

describe("Tx Sign", () => {
  const registry = container.resolve<Registry>(TYPE_REGISTRY);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const userWalletSchema = container.resolve<UserWalletSchema>(USER_WALLET_SCHEMA);
  const userSchema = container.resolve<UserSchema>(USER_SCHEMA);

  afterEach(async () => {
    await Promise.all([db.delete(userWalletSchema), db.delete(userSchema)]);
  });

  describe("POST /v1/tx", () => {
    it("should create a wallet for a user", async () => {
      const userResponse = await app.request("/v1/anonymous-users", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const {
        data: { id: userId }
      } = await userResponse.json();
      const walletResponse = await app.request("/v1/wallets", {
        method: "POST",
        body: JSON.stringify({
          data: { userId }
        }),
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const { data: wallet } = await walletResponse.json();
      const { cert, publicKey } = certificateManager.generatePEM(wallet.address);

      const message = {
        typeUrl: "/akash.cert.v1beta3.MsgCreateCertificate",
        value: {
          owner: wallet.address,
          cert: Buffer.from(cert).toString("base64"),
          pubkey: Buffer.from(publicKey).toString("base64")
        }
      };
      const res = await app.request("/v1/tx", {
        method: "POST",
        body: JSON.stringify({
          data: {
            userId: userId,
            messages: [
              {
                typeUrl: message.typeUrl,
                value: Buffer.from(registry.encode(message)).toString("base64")
              }
            ]
          }
        }),
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ data: { code: 0, transactionHash: expect.any(String) } });
    });
  });
});
