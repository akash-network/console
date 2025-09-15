import { createSignArbitraryAkashWallet, JwtToken } from "@akashnetwork/jwt";
import type { AccessScope, JwtTokenPayload } from "@akashnetwork/jwt/src/types";
import { minutesToSeconds } from "date-fns";
import { singleton } from "tsyringe";
import * as uuid from "uuid";

import { Wallet } from "@src/billing/lib/wallet/wallet";
import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { Memoize } from "@src/caching/helpers";

const JWT_TOKEN_TTL_IN_SECONDS = 30;

type JwtTokenWithAddress = {
  jwtToken: JwtToken;
  address: string;
};

type GenerateJwtTokenParams = {
  walletId: number;
  leases: JwtTokenPayload["leases"];
  ttl?: number;
};

@singleton()
export class ProviderJwtTokenService {
  constructor(@InjectBillingConfig() private readonly config: BillingConfig) {}

  async generateJwtToken({ walletId, leases, ttl = JWT_TOKEN_TTL_IN_SECONDS }: GenerateJwtTokenParams) {
    const { jwtToken, address } = await this.getJwtToken(walletId.toString());
    const now = Math.floor(Date.now() / 1000);

    const token = await jwtToken.createToken({
      iss: address,
      exp: now + ttl,
      nbf: now,
      iat: now,
      jti: uuid.v4(),
      version: "v1",
      leases
    });

    return token;
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  private async getJwtToken(walletId: string): Promise<JwtTokenWithAddress> {
    const wallet = new Wallet(this.config.MASTER_WALLET_MNEMONIC, Number(walletId));
    const akashWallet = await createSignArbitraryAkashWallet(await wallet.getInstance());
    const jwtToken = new JwtToken(akashWallet);

    return { jwtToken, address: akashWallet.address };
  }

  getGranularLeases({ provider, scope }: { provider: string; scope: AccessScope[] }): JwtTokenPayload["leases"] {
    return {
      access: "granular",
      permissions: [{ provider, access: "scoped", scope }]
    };
  }
}
