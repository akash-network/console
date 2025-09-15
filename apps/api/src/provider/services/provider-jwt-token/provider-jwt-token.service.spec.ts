import * as JwtModule from "@akashnetwork/jwt";
import type { JwtTokenPayload } from "@akashnetwork/jwt/src/types";
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
  const mockAddress = "akash1testaddress123456789";

  describe("generateJwtToken", () => {
    it("should generate a JWT token successfully", async () => {
      const { providerJwtTokenService, mockWalletId, mockWallet, leases } = setup();

      const now = Math.floor(Date.now() / 1000);
      jest.spyOn(Date, "now").mockReturnValue(now * 1000);

      const result = JSON.parse(await providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases }));

      expect(result.leases).toEqual(leases);
      expect(WalletModule.Wallet).toHaveBeenCalledWith(mockMnemonic, mockWalletId);
      expect(mockWallet.getInstance).toHaveBeenCalled();
    });

    it("generates a JWT token with 30 seconds of a TTL by default", async () => {
      const { providerJwtTokenService, mockWalletId, leases } = setup();

      const result = JSON.parse(await providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases }));

      expect(result.exp).toBe(result.iat + 30);
    });

    it("can generate a JWT token with a custom TTL", async () => {
      const { providerJwtTokenService, mockWalletId, leases } = setup();
      const ttl = 100;

      const result = JSON.parse(await providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases, ttl }));

      expect(result.exp).toBe(result.iat + ttl);
    });

    it("memoizes JWT Token generation", async () => {
      const { providerJwtTokenService, mockWalletId, leases } = setup();

      await providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases });
      await providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases });

      expect(WalletModule.Wallet).toHaveBeenCalledTimes(1);
      expect(JwtModule.createSignArbitraryAkashWallet).toHaveBeenCalledTimes(1);
      expect(JwtModule.JwtToken).toHaveBeenCalledTimes(1);
    });

    it("should generate unique jti for each token", async () => {
      const { providerJwtTokenService, mockWalletId, leases } = setup();

      const tokens = (
        await Promise.all([
          providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases }),
          providerJwtTokenService.generateJwtToken({ walletId: mockWalletId, leases })
        ])
      ).map(token => JSON.parse(token));

      expect(tokens[0].jti).not.toBe(tokens[1].jti);
    });

    it("should work with different wallet IDs", async () => {
      const { providerJwtTokenService, leases } = setup();

      await providerJwtTokenService.generateJwtToken({ walletId: 1, leases });
      await providerJwtTokenService.generateJwtToken({ walletId: 999, leases });

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
    leases: JwtTokenPayload["leases"];
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

    const leases: JwtTokenPayload["leases"] = {
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
      leases
    };
  }
});
