import { createSignArbitraryAkashWallet, JwtToken } from "@akashnetwork/jwt";
import { singleton } from "tsyringe";
import * as uuid from "uuid";

import { Wallet } from "@src/billing/lib/wallet/wallet";
import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";

const JWT_TOKEN_TTL_IN_SECONDS = 30;

@singleton()
export class JwtTokenService {
  constructor(@InjectBillingConfig() private readonly config: BillingConfig) {}

  async generateJwtToken(walletId: number) {
    const wallet = new Wallet(this.config.MASTER_WALLET_MNEMONIC, walletId);
    const akashWallet = await createSignArbitraryAkashWallet(await wallet.getInstance());
    const jwtToken = new JwtToken(akashWallet);
    const now = Math.floor(Date.now() / 1000);

    const token = await jwtToken.createToken({
      iss: akashWallet.address,
      exp: now + JWT_TOKEN_TTL_IN_SECONDS,
      nbf: now,
      iat: now,
      jti: uuid.v4(),
      version: "v1",
      leases: { access: "full" }
    });

    return token;
  }
}
