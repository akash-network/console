import { JwtToken, type Scope } from "@akashnetwork/jwt";
import { singleton } from "tsyringe";

import { Wallet } from "@src/billing/lib/wallet/wallet";
import { UserWalletOutput } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";

@singleton()
export class JwtService {
  private jwtToken: JwtToken;
  private wallet: Wallet;

  constructor(private readonly config: BillingConfigService) {}

  private async getWallet(currentWallet: UserWalletOutput): Promise<{ wallet: Wallet; jwtToken: JwtToken }> {
    if (!this.wallet || !this.jwtToken) {
      this.wallet = new Wallet(this.config.get("MASTER_WALLET_MNEMONIC"), currentWallet.id);
      const signArbitrary = await this.wallet.getSignArbitrary();
      this.jwtToken = new JwtToken(signArbitrary);
    }
    return { wallet: this.wallet, jwtToken: this.jwtToken };
  }

  async generateProviderToken(currentWallet: UserWalletOutput, providerAddress: string, dseq: string): Promise<string> {
    const { jwtToken } = await this.getWallet(currentWallet);
    const now = Math.floor(Date.now() / 1000);
    const scopes: Scope[] = ["send-manifest", "get-manifest", "status"];

    return jwtToken.createToken({
      iss: providerAddress,
      exp: now + 3600, // 1 hour expiration
      iat: now,
      nbf: now, // Not valid before current time
      version: "v1",
      leases: {
        access: "granular",
        permissions: [
          {
            provider: providerAddress,
            access: "granular",
            deployments: [
              {
                dseq: parseInt(dseq),
                scope: scopes
              }
            ]
          }
        ]
      }
    });
  }

  validateToken(token: string): boolean {
    try {
      const payload = this.jwtToken.decodeToken(token);
      const validation = this.jwtToken.validatePayload(payload);
      return validation.isValid;
    } catch (error) {
      return false;
    }
  }
}
