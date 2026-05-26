import { JwtTokenManager, JwtTokenPayload } from "@akashnetwork/chain-sdk";
import { minutesToSeconds } from "date-fns";
import { randomUUID } from "node:crypto";
import { Err, Ok, Result } from "ts-results";
import { inject, singleton } from "tsyringe";

import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { Memoize } from "@src/caching/helpers";
import type { JWTModule } from "@src/provider/providers/jwt.provider";
import { JWT_MODULE } from "@src/provider/providers/jwt.provider";

const JWT_TOKEN_TTL_IN_SECONDS = 30;

type JwtTokenWithAddress = {
  jwtTokenManager: JwtTokenManager;
  address: string;
};

type GenerateJwtTokenParams = {
  walletId: number;
  leases: JwtTokenPayload["leases"];
  ttl?: number;
};

type AccessScope = Extract<Extract<JwtTokenPayload["leases"], { access: "granular" }>["permissions"][number], { access: "scoped" }>["scope"][number];

@singleton()
export class ProviderJwtTokenService {
  constructor(
    @inject(JWT_MODULE) private readonly jwtModule: JWTModule,
    private readonly txManagerService: TxManagerService
  ) {}

  async generateJwtToken({ walletId, leases, ttl = JWT_TOKEN_TTL_IN_SECONDS }: GenerateJwtTokenParams): Promise<Result<string, string[]>> {
    const { jwtTokenManager, address } = await this.getJwtToken(walletId);
    const now = Math.floor(Date.now() / 1000);
    const payload: JwtTokenPayload = {
      version: "v1",
      exp: now + ttl,
      nbf: now,
      iat: now,
      iss: address,
      jti: randomUUID(),
      leases
    };

    const validationResult = jwtTokenManager.validatePayload(payload);
    if (validationResult.errors) return Err(validationResult.errors);

    return Ok(await jwtTokenManager.generateToken(payload));
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  private async getJwtToken(walletId: number): Promise<JwtTokenWithAddress> {
    const wallet = this.txManagerService.getDerivedWallet(walletId);
    const jwtTokenManager = new this.jwtModule.JwtTokenManager(wallet);
    const address = await wallet.getFirstAddress();

    return { jwtTokenManager, address };
  }

  getGranularLeases({ provider, scope }: { provider: string; scope: AccessScope[] }): JwtTokenPayload["leases"] {
    return {
      access: "granular",
      permissions: [{ provider, access: "scoped", scope }]
    };
  }
}
