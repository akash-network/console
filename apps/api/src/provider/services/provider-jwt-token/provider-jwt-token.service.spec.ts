import type { JwtTokenPayload } from "@akashnetwork/jwt";
import * as JwtModule from "@akashnetwork/jwt";
import type { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";
import { container } from "tsyringe";

import * as WalletModule from "@src/billing/lib/wallet/wallet";
import type { BillingConfig } from "@src/billing/providers";
import { ProviderJwtTokenService } from "./provider-jwt-token.service";

import { createAkashAddress } from "@test/seeders";

describe(ProviderJwtTokenService.name, () => {
  const mockMnemonic = "test mnemonic phrase for testing purposes only";
  const mockAddress = createAkashAddress();

  describe("generateJwtToken", () => {
    it("should generate a JWT token successfully", async () => {
      const { providerJwtTokenService, mockWalletId, mockWallet, accessRules } = setup();

      const now = Math.floor(Date.now() / 1000);
      jest.spyOn(Date, "now").mockReturnValue(now * 1000);

      const result = JSON.parse(await providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases: accessRules }));

      expect(result.leases).toEqual(accessRules);
      expect(WalletModule.Wallet).toHaveBeenCalledWith(mockMnemonic, mockWalletId);
      expect(mockWallet.getInstance).toHaveBeenCalled();
    });

    it("generates a JWT token with 30 seconds of a TTL by default", async () => {
      const { providerJwtTokenService, mockWalletId, accessRules } = setup();

      const result = JSON.parse(await providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases: accessRules }));

      expect(result.exp).toBe(result.iat + 30);
    });

    it("can generate a JWT token with a custom TTL", async () => {
      const { providerJwtTokenService, mockWalletId, accessRules } = setup();
      const ttl = 100;

      const result = JSON.parse(await providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases: accessRules, ttl }));

      expect(result.exp).toBe(result.iat + ttl);
    });

    it("memoizes JWT Token generation", async () => {
      const { providerJwtTokenService, mockWalletId, accessRules } = setup();

      await providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases: accessRules });
      await providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases: accessRules });

      expect(WalletModule.Wallet).toHaveBeenCalledTimes(1);
      expect(JwtModule.createSignArbitraryAkashWallet).toHaveBeenCalledTimes(1);
      expect(JwtModule.JwtToken).toHaveBeenCalledTimes(1);
    });

    it("should generate unique jti for each token", async () => {
      const { providerJwtTokenService, mockWalletId, accessRules } = setup();

      const tokens = (
        await Promise.all([
          providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases: accessRules }),
          providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases: accessRules })
        ])
      ).map(token => JSON.parse(token));

      expect(tokens[0].jti).not.toBe(tokens[1].jti);
    });

    it("should work with different wallet IDs", async () => {
      const { providerJwtTokenService, accessRules } = setup();

      await providerJwtTokenService.generateJwtToken({ walletId: 1, leases: accessRules });
      await providerJwtTokenService.generateJwtToken({ walletId: 999, leases: accessRules });

      expect(WalletModule.Wallet).toHaveBeenCalledWith(mockMnemonic, 1);
      expect(WalletModule.Wallet).toHaveBeenCalledWith(mockMnemonic, 999);
    });
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

  function setup(): {
    providerJwtTokenService: ProviderJwtTokenService;
    mockBillingConfig: MockProxy<BillingConfig>;
    mockWalletId: number;
    mockWallet: MockProxy<WalletModule.Wallet>;
    accessRules: JwtTokenPayload["leases"];
  } {
    jest.clearAllMocks();
    const mockWalletId = faker.number.int({ min: 1, max: 10000 });

    const mockWallet = mock<WalletModule.Wallet>();
    const mockDirectSecp256k1HdWallet = mock<DirectSecp256k1HdWallet>();
    mockDirectSecp256k1HdWallet.getAccounts.mockResolvedValue([{ address: mockAddress, pubkey: new Uint8Array([1, 2, 3]), algo: "secp256k1" }]);
    mockWallet.getInstance.mockResolvedValue(mockDirectSecp256k1HdWallet);

    const mockBillingConfig = mock<BillingConfig>();
    mockBillingConfig.MASTER_WALLET_MNEMONIC = mockMnemonic;

    jest.spyOn(WalletModule, "Wallet").mockImplementation(() => mockWallet);

    const mockAkashWallet = {
      address: mockAddress,
      pubkey: new Uint8Array([1, 2, 3]),
      signArbitrary: jest.fn().mockResolvedValue({ signature: "test-signature" })
    };

    jest.spyOn(JwtModule, "createSignArbitraryAkashWallet").mockResolvedValue(mockAkashWallet);
    jest.spyOn(JwtModule, "JwtToken").mockImplementation(
      () =>
        ({
          createToken: jest.fn().mockImplementation(args => JSON.stringify(args))
        }) as unknown as JwtModule.JwtToken
    );

    container.clearInstances();
    container.register("BILLING_CONFIG", { useValue: mockBillingConfig });

    const providerJwtTokenService = new ProviderJwtTokenService(mockBillingConfig);

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
      mockBillingConfig,
      mockWalletId,
      mockWallet,
      accessRules
    };
  }
});
