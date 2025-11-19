import type { InjectionToken } from "tsyringe";
import { container, inject, instancePerContainerCachingFactory } from "tsyringe";

import type { Wallet, WalletFactory } from "@src/billing/lib/wallet/wallet";
import { walletFactory } from "@src/billing/lib/wallet/wallet";
import type { MasterWalletType } from "@src/billing/types/wallet.type";
import { BILLING_CONFIG } from "./config.provider";

export const MANAGED_MASTER_WALLET: InjectionToken<Wallet> = Symbol("MANAGED_MASTER_WALLET");
container.register(MANAGED_MASTER_WALLET, {
  useFactory: instancePerContainerCachingFactory(c => c.resolve(WALLET_FACTORY)(c.resolve(BILLING_CONFIG).MASTER_WALLET_MNEMONIC))
});

const WALLET_MAPPING = {
  MANAGED: MANAGED_MASTER_WALLET
};
export const InjectWallet = (walletType: MasterWalletType) => inject(WALLET_MAPPING[walletType]);

export const WALLET_FACTORY: InjectionToken<WalletFactory> = "WALLET_FACTORY";
container.register(WALLET_FACTORY, {
  useValue: walletFactory
});
