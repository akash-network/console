import * as JwtModule from "@akashnetwork/jwt";
import type { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";
import { container } from "tsyringe";

import * as WalletModule from "@src/billing/lib/wallet/wallet";
import type { BillingConfig } from "@src/billing/providers";
import { JwtTokenService } from "./jwt-token.service";

import { createAkashAddress } from "@test/seeders";

describe("JwtTokenService", () => {
  const mockMnemonic = "test mnemonic phrase for testing purposes only";
  const mockAddress = "akash1testaddress123456789";

  describe("generateJwtToken", () => {
    it("should generate a JWT token successfully", async () => {
      const { jwtTokenService, mockWalletId, mockWallet, mockProvider } = setup();

      const now = Math.floor(Date.now() / 1000);
      jest.spyOn(Date, "now").mockReturnValue(now * 1000);

      const result = JSON.parse(await jwtTokenService.generateJwtToken({ walletId: mockWalletId, provider: mockProvider }));

      expect(result.leases).toEqual({
        access: "granular",
        permissions: [
          {
            provider: mockProvider,
            access: "full"
          }
        ]
      });
      expect(WalletModule.Wallet).toHaveBeenCalledWith(mockMnemonic, mockWalletId);
      expect(mockWallet.getInstance).toHaveBeenCalled();
    });

    it("memoizes JWT Token generation", async () => {
      const { jwtTokenService, mockWalletId, mockProvider } = setup();

      await jwtTokenService.generateJwtToken({ walletId: mockWalletId, provider: mockProvider });
      await jwtTokenService.generateJwtToken({ walletId: mockWalletId, provider: mockProvider });

      expect(WalletModule.Wallet).toHaveBeenCalledTimes(1);
      expect(JwtModule.createSignArbitraryAkashWallet).toHaveBeenCalledTimes(1);
      expect(JwtModule.JwtToken).toHaveBeenCalledTimes(1);
    });

    it("should generate unique jti for each token", async () => {
      const { jwtTokenService, mockWalletId, mockProvider } = setup();

      const tokens = (
        await Promise.all([
          jwtTokenService.generateJwtToken({ walletId: mockWalletId, provider: mockProvider }),
          jwtTokenService.generateJwtToken({ walletId: mockWalletId, provider: mockProvider })
        ])
      ).map(token => JSON.parse(token));

      expect(tokens[0].jti).not.toBe(tokens[1].jti);
    });

    it("should work with different wallet IDs", async () => {
      const { jwtTokenService, mockProvider } = setup();

      await jwtTokenService.generateJwtToken({ walletId: 1, provider: mockProvider });
      await jwtTokenService.generateJwtToken({ walletId: 999, provider: mockProvider });

      expect(WalletModule.Wallet).toHaveBeenCalledWith(mockMnemonic, 1);
      expect(WalletModule.Wallet).toHaveBeenCalledWith(mockMnemonic, 999);
    });
  });

  function setup(): {
    jwtTokenService: JwtTokenService;
    mockBillingConfig: MockProxy<BillingConfig>;
    mockWalletId: number;
    mockWallet: MockProxy<WalletModule.Wallet>;
    mockProvider: string;
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

    const jwtTokenService = new JwtTokenService(mockBillingConfig);
    const mockProvider = createAkashAddress();

    return {
      jwtTokenService,
      mockBillingConfig,
      mockWalletId,
      mockWallet,
      mockProvider
    };
  }
});
