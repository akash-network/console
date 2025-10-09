import { JwtTokenManager, JwtTokenPayload } from "@akashnetwork/chain-sdk";
import { minutesToSeconds } from "date-fns";
import { inject, singleton } from "tsyringe";
import * as uuid from "uuid";

import { WalletFactory } from "@src/billing/lib/wallet/wallet";
import { WALLET_FACTORY } from "@src/billing/providers/wallet.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { Memoize } from "@src/caching/helpers";
import { JWT_MODULE, JWTModule } from "@src/provider/providers/jwt.provider";

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
    private readonly billingConfigService: BillingConfigService,
    @inject(WALLET_FACTORY) private readonly walletFactory: WalletFactory
  ) {}

  async generateJwtToken({ walletId, leases, ttl = JWT_TOKEN_TTL_IN_SECONDS }: GenerateJwtTokenParams) {
    const { jwtTokenManager, address } = await this.getJwtToken(walletId);
    const now = Math.floor(Date.now() / 1000);

    return await jwtTokenManager.generateToken({
      version: "v1",
      exp: now + ttl,
      nbf: now,
      iat: now,
      iss: address,
      jti: uuid.v4(),
      leases
    });
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  private async getJwtToken(walletId: number): Promise<JwtTokenWithAddress> {
    const wallet = this.walletFactory(this.billingConfigService.get("MASTER_WALLET_MNEMONIC"), walletId);
    const akashWallet = await this.jwtModule.createSignArbitraryAkashWallet((await wallet.getInstance()) as any, walletId);
    const jwtTokenManager = new this.jwtModule.JwtTokenManager(akashWallet);

    return { jwtTokenManager, address: akashWallet.address };
  }

  getGranularLeases({ provider, scope }: { provider: string; scope: AccessScope[] }): JwtTokenPayload["leases"] {
    return {
      access: "granular",
      permissions: [{ provider, access: "scoped", scope }]
    };
  }
}
