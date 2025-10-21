import { JwtTokenPayload } from "@akashnetwork/chain-sdk";
import { BadRequest, HttpError, Unauthorized } from "http-errors";
import { Err, Result } from "ts-results";
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

  async createJwtToken(payload: CreateJwtTokenRequest): Promise<Result<CreateJwtTokenResponse, HttpError>> {
    if (!this.authService.currentUser) return Err(new Unauthorized());

    const wallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "sign").findOneByUserId(this.authService.currentUser.id);
    if (!wallet) return Err(new BadRequest("User does not have a wallet"));

    const result = await this.providerJwtTokenService.generateJwtToken({
      walletId: wallet.id,
      leases: payload.leases as JwtTokenPayload["leases"],
      ttl: payload.ttl
    });

    return result.map(token => ({ token })).mapErr(errors => new BadRequest(errors.join(".\n")));
  }
}
