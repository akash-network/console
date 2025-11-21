import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";
import { Ok } from "ts-results";

import { UserSeeder } from "../../../../test/seeders/user.seeder";
import { UserWalletSeeder } from "../../../../test/seeders/user-wallet.seeder";
import type { AuthService } from "../../../auth/services/auth.service";
import type { UserWalletRepository } from "../../../billing/repositories";
import type { UserOutput } from "../../../user/repositories/user/user.repository";
import type { CreateJwtTokenRequest } from "../../http-schemas/jwt-token.schema";
import type { ProviderJwtTokenService } from "../../services/provider-jwt-token/provider-jwt-token.service";
import { JwtTokenController } from "./jwt-token.controller";

describe(JwtTokenController.name, () => {
  describe("createJwtToken", () => {
    it("creates JWT token successfully when user has wallet", async () => {
      const user = UserSeeder.create();
      const { controller, authService, userWalletRepository, providerJwtTokenService, jwtToken, wallet } = setup({ user });

      authService.currentUser = user;
      userWalletRepository.accessibleBy.mockReturnThis();
      userWalletRepository.findOneByUserId.mockResolvedValue(wallet);
      providerJwtTokenService.generateJwtToken.mockResolvedValue(Ok(jwtToken));

      const payload = createPayload();
      const result = await controller.createJwtToken(payload);

      expect(result.unwrap()).toEqual({ token: jwtToken });
      expect(userWalletRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "sign");
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(user.id);
      expect(providerJwtTokenService.generateJwtToken).toHaveBeenCalledWith({
        walletId: wallet.id,
        leases: payload.leases,
        ttl: payload.ttl,
        useOldWallet: false
      });
    });

    it("returns UnauthorizedError when user is not authenticated", async () => {
      const { controller, authService } = setup();

      authService.currentUser = undefined as any;
      const result = await controller.createJwtToken(createPayload());

      expect(() => result.unwrap()).toThrow(/UnauthorizedError/);
    });

    it("returns BadRequestError when user has no wallet", async () => {
      const user = UserSeeder.create();
      const { controller, authService, userWalletRepository } = setup({ user });

      authService.currentUser = user;
      userWalletRepository.accessibleBy.mockReturnThis();
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);

      const result = await controller.createJwtToken(createPayload());
      expect(() => result.unwrap()).toThrow(/BadRequestError/);
    });
  });

  function setup(input?: { user?: UserOutput }) {
    const authService = mock<AuthService>();
    const userWalletRepository = mock<UserWalletRepository>();
    const providerJwtTokenService = mock<ProviderJwtTokenService>();

    const controller = new JwtTokenController(providerJwtTokenService, authService, userWalletRepository);

    const wallet = UserWalletSeeder.create({ userId: input?.user?.id });
    const jwtToken = faker.string.alphanumeric(64);

    return {
      controller,
      authService,
      userWalletRepository,
      providerJwtTokenService,
      jwtToken,
      wallet
    };
  }

  function createPayload(): CreateJwtTokenRequest {
    return {
      ttl: faker.number.int({ min: 3600, max: 86400 }),
      leases: {
        access: "full",
        scope: ["send-manifest", "get-manifest"]
      }
    };
  }
});
