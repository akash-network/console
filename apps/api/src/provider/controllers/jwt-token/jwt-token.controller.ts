import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { CreateJwtTokenRequest, CreateJwtTokenResponse } from "../../http-schemas/jwt-token.schema";
import { ProviderJwtTokenService } from "../../services/provider-jwt-token/provider-jwt-token.service";

@singleton()
export class JwtTokenController {
  constructor(
    private readonly providerJwtTokenService: ProviderJwtTokenService,
    private readonly authService: AuthService,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  async createJwtToken(payload: CreateJwtTokenRequest): Promise<CreateJwtTokenResponse> {
    assert(this.authService.currentUser, 401);

    const wallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "sign").findOneByUserId(this.authService.currentUser.id);
    assert(wallet, 400, "User does not have a wallet");

    const jwtToken = await this.providerJwtTokenService.generateJwtToken({
      walletId: wallet.id,
      leases: payload.leases,
      ttl: payload.ttl
    });

    return {
      token: jwtToken
    };
  }
}
