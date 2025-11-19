import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import type { Wallet, WalletFactory } from "@src/billing/lib/wallet/wallet";
import { walletFactory } from "@src/billing/lib/wallet/wallet";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";

// NOTE: do not use this registration directly.
//  Access only via TxManagerService
export const FUNDING_WALLET: InjectionToken<Wallet> = "FUNDING_WALLET";
container.register(FUNDING_WALLET, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(BillingConfigService);
    return c.resolve(WALLET_FACTORY)(config.get("FUNDING_WALLET_MNEMONIC"), 1);
  })
});

export const WALLET_FACTORY: InjectionToken<WalletFactory> = "WALLET_FACTORY";
container.register(WALLET_FACTORY, {
  useValue: walletFactory
});
