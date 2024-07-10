import { faker } from "@faker-js/faker";

import { app } from "@src/app";

jest.setTimeout(10000);

describe("Tx Sign", () => {
  describe("POST /v1/sign-tx", () => {
    it("should create a wallet for a user", async () => {
      const userId = faker.string.uuid();
      const walletResponse = await app.request("/v1/wallets", {
        method: "POST",
        body: JSON.stringify({ userId }),
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const wallet = await walletResponse.json();
      const res = await app.request("/v1/sign-tx", {
        method: "POST",
        body: JSON.stringify({
          userId: userId,
          messages: [
            {
              typeUrl: "/akash.cert.v1beta3.MsgCreateCertificate",
              value: {
                owner: wallet.address,
                cert: Buffer.from("crtpem").toString("base64"),
                pubkey: Buffer.from("pubpem").toString("base64")
              }
            }
          ],
          fee: {
            amount: [
              {
                denom: "uakt",
                amount: "1000"
              }
            ],
            gas: "200000"
          }
        }),
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatch("akash.cert.v1beta3.MsgCreateCertificate");
    });
  });
});
