import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { connectUsingSequelize } from "@src/chain";
import { CORE_CONFIG } from "@src/core";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories";
import { marketVersion } from "@src/utils/constants";

import { createAkashAddress, createProvider } from "@test/seeders";
import { BidSeeder } from "@test/seeders/bid.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe("Bids API", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);
  const userWalletRepository = container.resolve(UserWalletRepository);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe.each(["/v1/bids/:dseq", "/v1/bids?dseq=:dseq"])("GET %s", path => {
    it("responds with bids list", async () => {
      const { dseq, token, wallet, providers } = await setup();

      const response = await app.request(path.replace(":dseq", dseq), {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${token}` })
      });

      expect(await response.json()).toMatchObject({
        data: expect.arrayContaining([
          expectBid({ owner: wallet.address!, dseq, provider: providers[0].owner, isCertificateRequired: true }),
          expectBid({ owner: wallet.address!, dseq, provider: providers[1].owner, isCertificateRequired: false })
        ])
      });
    });
  });

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

  async function setup() {
    await connectUsingSequelize();
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const token = faker.string.alphanumeric(40);
    const wallet = UserWalletSeeder.create({ userId: user.id, address: createAkashAddress() });

    vi.spyOn(userAuthTokenService, "getValidUserId").mockResolvedValue(user.userId);
    vi.spyOn(userWalletRepository, "accessibleBy").mockReturnValue(userWalletRepository);
    vi.spyOn(userWalletRepository, "findFirst").mockResolvedValue(wallet);

    const dseq = faker.number.int({ min: 1000000, max: 9999999 }).toString();
    const providers = [
      { owner: createAkashAddress(), akashVersion: "0.8.0" },
      { owner: createAkashAddress(), akashVersion: "0.10.0" }
    ];

    await Promise.all(providers.map(async provider => createProvider(provider)));

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL, { allowUnmocked: true })
      .get(`/akash/market/${marketVersion}/bids/list`)
      .query({
        "filters.owner": wallet.address,
        "filters.dseq": dseq
      })
      .reply(200, {
        bids: [
          BidSeeder.create({ dseq, owner: wallet.address!, provider: providers[0].owner }),
          BidSeeder.create({ dseq, owner: wallet.address!, provider: providers[1].owner })
        ]
      });

    return { dseq, token, wallet, providers };
  }
});
