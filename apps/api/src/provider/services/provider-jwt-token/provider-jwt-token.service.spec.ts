import type { JwtTokenManager, JwtTokenPayload } from "@akashnetwork/chain-sdk";
import type { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import { mockConfigService } from "../../../../test/mocks/config-service.mock";
import type { Wallet } from "../../../billing/lib/wallet/wallet";
import type { BillingConfigService } from "../../../billing/services/billing-config/billing-config.service";
import type { JWTModule } from "../../providers/jwt.provider";
import { ProviderJwtTokenService } from "./provider-jwt-token.service";

import { createAkashAddress } from "@test/seeders";

describe(ProviderJwtTokenService.name, () => {
  describe("generateJwtToken", () => {
    it("should generate a JWT token successfully", async () => {
      const { providerJwtTokenService, walletId, accessRules, jwtTokenValue, jwtToken, walletFactory, masterWalletMnemonic, jwtModule, akashWallet, address } =
        setup();

      const result = await providerJwtTokenService.generateJwtToken({ walletId, leases: accessRules });

      expect(result.unwrap()).toEqual(jwtTokenValue);
      expect(walletFactory).toHaveBeenCalledWith(masterWalletMnemonic, walletId);
      expect(jwtModule.JwtTokenManager).toHaveBeenCalledWith(akashWallet);
      expect(jwtToken.generateToken).toHaveBeenCalledWith({
        version: "v1",
        exp: expect.any(Number),
        nbf: expect.any(Number),
        iat: expect.any(Number),
        iss: address,
        jti: expect.any(String),
        leases: accessRules
      });
    });

    it("memoizes JWT Token generation", async () => {
      const { providerJwtTokenService, walletId, accessRules, walletFactory, jwtModule } = setup();

      await providerJwtTokenService.generateJwtToken({ walletId, leases: accessRules });
      await providerJwtTokenService.generateJwtToken({ walletId, leases: accessRules });

      expect(walletFactory).toHaveBeenCalledTimes(1);
      expect(jwtModule.createSignArbitraryAkashWallet).toHaveBeenCalledTimes(1);
      expect(jwtModule.JwtTokenManager).toHaveBeenCalledTimes(1);
    });

    describe("getGranularLeases", () => {
      it("returns leases for a provider, scoped", () => {
        const { providerJwtTokenService } = setup();

        const provider = createAkashAddress();
        const result = providerJwtTokenService.getGranularLeases({ provider, scope: ["status"] });

        expect(result).toEqual({
          access: "granular",
          permissions: [
            {
              provider,
              access: "scoped",
              scope: ["status"]
            }
          ]
        });
      });
    });
  });

  function setup() {
    const walletId = faker.number.int({ min: 1, max: 10000 });
    const address = createAkashAddress();
    const masterWalletMnemonic = "test walk nut penalty hip pave soap entry language right filter choice";
    const jwtTokenValue = faker.string.alphanumeric();

    const directSecp256k1HdWallet = mock<DirectSecp256k1HdWallet>();
    directSecp256k1HdWallet.getAccounts.mockResolvedValue([{ address, pubkey: new Uint8Array([1, 2, 3]), algo: "secp256k1" }]);

    const wallet = mock<Wallet>();
    wallet.getInstance.mockResolvedValue(directSecp256k1HdWallet);

    const akashWallet = {
      address,
      pubkey: new Uint8Array([1, 2, 3]),
      signArbitrary: jest.fn().mockResolvedValue({ signature: "test-signature" })
    };

    const jwtToken = mock<JwtTokenManager>({
      validatePayload: jest.fn().mockReturnValue({ errors: undefined }),
      generateToken: jest.fn().mockResolvedValue(jwtTokenValue)
    });

    const jwtModule = mock<JWTModule>({
      createSignArbitraryAkashWallet: jest.fn(async () => akashWallet),
      JwtTokenManager: jest.fn(() => jwtToken)
    });

    const billingConfigService = mockConfigService<BillingConfigService>({
      MASTER_WALLET_MNEMONIC: masterWalletMnemonic
    });

    const walletFactory = jest.fn(() => wallet);

    const providerJwtTokenService = new ProviderJwtTokenService(jwtModule, billingConfigService, walletFactory);

    const accessRules: JwtTokenPayload["leases"] = {
      access: "granular",
      permissions: [
        {
          provider: createAkashAddress(),
          access: "full"
        }
      ]
    };

    return {
      providerJwtTokenService,
      walletId,
      accessRules,
      jwtTokenValue,
      masterWalletMnemonic,
      jwtModule,
      akashWallet,
      jwtToken,
      address,
      walletFactory,
      billingConfigService,
      wallet
    };
  }
});
