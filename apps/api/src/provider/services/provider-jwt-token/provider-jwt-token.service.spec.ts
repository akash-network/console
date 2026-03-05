import type { JwtTokenManager, JwtTokenPayload } from "@akashnetwork/chain-sdk";
import type { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import { mock } from "vitest-mock-extended";

import type { Wallet } from "../../../billing/lib/wallet/wallet";
import type { TxManagerService } from "../../../billing/services/tx-manager/tx-manager.service";
import type { JWTModule } from "../../providers/jwt.provider";
import { ProviderJwtTokenService } from "./provider-jwt-token.service";

import { createAkashAddress } from "@test/seeders";

describe(ProviderJwtTokenService.name, () => {
  describe("generateJwtToken", () => {
    it("should generate a JWT token successfully", async () => {
      const { providerJwtTokenService, walletId, accessRules, jwtTokenValue, jwtToken, txManagerService, jwtModule, address, wallet } = setup();

      const result = await providerJwtTokenService.generateJwtToken({ walletId, leases: accessRules });

      expect(result.unwrap()).toEqual(jwtTokenValue);
      expect(txManagerService.getDerivedWallet).toHaveBeenCalledWith(walletId);
      expect(jwtModule.JwtTokenManager).toHaveBeenCalledWith(wallet);
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
      const { providerJwtTokenService, walletId, accessRules, txManagerService, jwtModule } = setup();

      await providerJwtTokenService.generateJwtToken({ walletId, leases: accessRules });
      await providerJwtTokenService.generateJwtToken({ walletId, leases: accessRules });

      expect(txManagerService.getDerivedWallet).toHaveBeenCalledTimes(1);
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
    const jwtTokenValue = faker.string.alphanumeric();

    const directSecp256k1HdWallet = mock<DirectSecp256k1HdWallet>();
    directSecp256k1HdWallet.getAccounts.mockResolvedValue([{ address, pubkey: new Uint8Array([1, 2, 3]), algo: "secp256k1" }]);

    const wallet = mock<Wallet>({
      getFirstAddress: vi.fn().mockResolvedValue(address),
      signAmino: vi.fn().mockResolvedValue({
        signature: {
          signature: "test-signature"
        }
      })
    });

    const jwtToken = mock<JwtTokenManager>({
      validatePayload: vi.fn().mockReturnValue({ errors: undefined }),
      generateToken: vi.fn().mockResolvedValue(jwtTokenValue)
    });

    // Create a constructor function for JwtTokenManager
    const JwtTokenManagerConstructor = vi.fn().mockImplementation(function () {
      return jwtToken;
    });

    const jwtModule = mock<JWTModule>({
      JwtTokenManager: JwtTokenManagerConstructor as unknown as typeof JwtTokenManager
    });

    const txManagerService = mock<TxManagerService>({
      getDerivedWallet: vi.fn().mockReturnValue(wallet)
    });

    const providerJwtTokenService = new ProviderJwtTokenService(jwtModule, txManagerService);

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
      jwtModule,
      jwtToken,
      address,
      wallet,
      txManagerService
    };
  }
});
