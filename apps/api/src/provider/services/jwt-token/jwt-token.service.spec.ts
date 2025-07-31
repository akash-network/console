import * as JwtModule from "@akashnetwork/jwt";
import type { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";
import { container } from "tsyringe";

import * as WalletModule from "@src/billing/lib/wallet/wallet";
import type { BillingConfig } from "@src/billing/providers";
import { JwtTokenService } from "./jwt-token.service";

describe("JwtTokenService", () => {
  const mockMnemonic = "test mnemonic phrase for testing purposes only";
  const mockWalletId = 123;
  const mockAddress = "akash1testaddress123456789";
  const mockToken =
    "eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJha2FzaDF0ZXN0YWRkcmVzcyIsImV4cCI6MTcwMDAwMDAxMCwibmJmIjoxNzAwMDAwMDAwLCJpYXQiOjE3MDAwMDAwMDAsImp0aSI6InRlc3QtdXVpZCIsInZlcnNpb24iOiJ2MSIsImxlYXNlcyI6eyJhY2Nlc3MiOiJmdWxsIn19.test-signature";

  describe("generateJwtToken", () => {
    it("should generate a JWT token successfully", async () => {
      const { jwtTokenService, mockWallet } = setup();

      const now = Math.floor(Date.now() / 1000);
      jest.spyOn(Date, "now").mockReturnValue(now * 1000);

      const result = await jwtTokenService.generateJwtToken(mockWalletId);

      expect(result).toBe(mockToken);
      expect(WalletModule.Wallet).toHaveBeenCalledWith(mockMnemonic, mockWalletId);
      expect(mockWallet.getInstance).toHaveBeenCalled();
    });

    it("should generate unique jti for each token", async () => {
      const { jwtTokenService, mockCreateToken } = setup();

      await jwtTokenService.generateJwtToken(mockWalletId);
      await jwtTokenService.generateJwtToken(mockWalletId);

      expect(JwtModule.JwtToken).toHaveBeenCalledTimes(2);

      const createTokenCalls = jest.mocked(mockCreateToken).mock.calls;
      const jtis = createTokenCalls.map(call => call[0].jti);
      expect(jtis[0]).not.toBe(jtis[1]);
    });

    it("should work with different wallet IDs", async () => {
      const { jwtTokenService } = setup();

      await jwtTokenService.generateJwtToken(1);
      await jwtTokenService.generateJwtToken(999);

      expect(WalletModule.Wallet).toHaveBeenCalledWith(mockMnemonic, 1);
      expect(WalletModule.Wallet).toHaveBeenCalledWith(mockMnemonic, 999);
    });
  });

  function setup(): {
    jwtTokenService: JwtTokenService;
    mockBillingConfig: MockProxy<BillingConfig>;
    mockWallet: MockProxy<WalletModule.Wallet>;
    mockCreateToken: JwtModule.JwtToken["createToken"];
  } {
    jest.clearAllMocks();

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
    const mockCreateToken = jest.fn().mockResolvedValue(mockToken);
    jest.spyOn(JwtModule, "JwtToken").mockImplementation(
      () =>
        ({
          createToken: mockCreateToken
        }) as unknown as JwtModule.JwtToken
    );

    container.clearInstances();
    container.register("BILLING_CONFIG", { useValue: mockBillingConfig });

    const jwtTokenService = new JwtTokenService(mockBillingConfig);

    return {
      jwtTokenService,
      mockBillingConfig,
      mockWallet,
      mockCreateToken
    };
  }
});
