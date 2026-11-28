import type { JwtTokenManager, JwtTokenPayload } from "@akashnetwork/chain-sdk";
import type { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import { Err, Ok } from "ts-results";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Wallet } from "../../../billing/lib/wallet/wallet";
import type { ExternalSignerHttpSdkService } from "../../../billing/services/external-signer-http-sdk/external-signer-http-sdk.service";
import type { TxManagerService } from "../../../billing/services/tx-manager/tx-manager.service";
import { cacheEngine } from "../../../caching/helpers";
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

    it("asks the signer for the token when this process holds no derivation seed", async () => {
      const { providerJwtTokenService, walletId, accessRules, externalSignerHttpSdkService, txManagerService, jwtModule } = setup({
        holdsDerivationSeed: false
      });
      externalSignerHttpSdkService.issueProviderToken.mockResolvedValue(Ok("token-from-signer"));

      const result = await providerJwtTokenService.generateJwtToken({ walletId, leases: accessRules, ttl: 90 });

      expect(result.unwrap()).toBe("token-from-signer");
      expect(externalSignerHttpSdkService.issueProviderToken).toHaveBeenCalledWith({ derivationIndex: walletId, leases: accessRules, ttl: 90 });
      expect(txManagerService.getDerivedWallet).not.toHaveBeenCalled();
      expect(jwtModule.JwtTokenManager).not.toHaveBeenCalled();
    });

    it("asks the signer for a token that lasts 30 seconds when no lifetime is named", async () => {
      const { providerJwtTokenService, walletId, accessRules, externalSignerHttpSdkService } = setup({ holdsDerivationSeed: false });
      externalSignerHttpSdkService.issueProviderToken.mockResolvedValue(Ok("token-from-signer"));

      await providerJwtTokenService.generateJwtToken({ walletId, leases: accessRules });

      expect(externalSignerHttpSdkService.issueProviderToken).toHaveBeenCalledWith({ derivationIndex: walletId, leases: accessRules, ttl: 30 });
    });

    it("passes on why the signer refused a token", async () => {
      const { providerJwtTokenService, walletId, accessRules, externalSignerHttpSdkService } = setup({ holdsDerivationSeed: false });
      externalSignerHttpSdkService.issueProviderToken.mockResolvedValue(Err(["permissions must not be empty"]));

      const result = await providerJwtTokenService.generateJwtToken({ walletId, leases: accessRules });

      expect(result.val).toEqual(["permissions must not be empty"]);
    });

    it("signs the token itself, without the signer, when this process holds the derivation seed", async () => {
      const { providerJwtTokenService, walletId, accessRules, externalSignerHttpSdkService, jwtTokenValue } = setup();

      const result = await providerJwtTokenService.generateJwtToken({ walletId, leases: accessRules });

      expect(result.unwrap()).toBe(jwtTokenValue);
      expect(externalSignerHttpSdkService.issueProviderToken).not.toHaveBeenCalled();
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

  function setup(input?: { holdsDerivationSeed?: boolean }) {
    cacheEngine.clearByPrefix(`${ProviderJwtTokenService.name}#`);
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
      holdsDerivationSeed: input?.holdsDerivationSeed ?? true,
      getDerivedWallet: vi.fn().mockReturnValue(wallet)
    });
    const externalSignerHttpSdkService = mock<ExternalSignerHttpSdkService>();

    const providerJwtTokenService = new ProviderJwtTokenService(jwtModule, txManagerService, externalSignerHttpSdkService);

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
      txManagerService,
      externalSignerHttpSdkService
    };
  }
});
