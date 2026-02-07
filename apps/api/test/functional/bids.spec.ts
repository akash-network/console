import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";

import { CORE_CONFIG } from "@src/core";
import { app } from "@src/rest-app";
import { marketVersion } from "@src/utils/constants";

import { createAkashAddress, createProvider } from "@test/seeders";
import { BidSeeder } from "@test/seeders/bid.seeder";
import { topUpWallet } from "@test/services/topUpWallet";
import { WalletTestingService } from "@test/services/wallet-testing.service";

describe("Bids API", () => {
  beforeAll(async () => {
    await topUpWallet();
  });

  describe.each(["/v1/bids/:dseq", "/v1/bids?dseq=:dseq"])("GET %s", path => {
    it("should respond with bids list", async () => {
      const { dseq, user, providers } = await setup();
      const response = await app.request(path.replace(":dseq", dseq), {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${user.token}` })
      });

      expect(await response.json()).toMatchObject({
        data: expect.arrayContaining([
          expectBid({ owner: user.wallet.address, dseq, provider: providers[0].owner, isCertificateRequired: true }),
          expectBid({ owner: user.wallet.address, dseq, provider: providers[1].owner, isCertificateRequired: false })
        ])
      });
    });
  });

  async function setup() {
    const walletService = new WalletTestingService(app);
    const user = await walletService.createUserAndWallet();
    const dseq = faker.number.int({ min: 1000000, max: 9999999 }).toString();
    const providers = [
      {
        owner: createAkashAddress(),
        akashVersion: "0.8.0"
      },
      {
        owner: createAkashAddress(),
        akashVersion: "0.10.0"
      }
    ];

    await Promise.all(providers.map(async provider => createProvider(provider)));

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL, { allowUnmocked: true })
      .get(`/akash/market/${marketVersion}/bids/list`)
      .query({
        "filters.owner": user.wallet.address,
        "filters.dseq": dseq
      })
      .reply(200, {
        bids: [
          BidSeeder.create({ dseq: dseq, owner: user.wallet.address, provider: providers[0].owner }),
          BidSeeder.create({ dseq: dseq, owner: user.wallet.address, provider: providers[1].owner })
        ]
      });

    return {
      dseq,
      user,
      providers
    };
  }

  function expectBid(params: { owner: string; dseq: string; provider: string; isCertificateRequired: boolean }) {
    return expect.objectContaining({
      bid: expect.objectContaining({
        id: expect.objectContaining({
          owner: params.owner,
          dseq: params.dseq,
          provider: params.provider
        })
      }),
      isCertificateRequired: params.isCertificateRequired
    });
  }
});
