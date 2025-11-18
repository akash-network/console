import type { InjectionToken } from "tsyringe";
import { container, inject, instancePerContainerCachingFactory } from "tsyringe";

import { config } from "@src/billing/config";
import type { Wallet, WalletFactory } from "@src/billing/lib/wallet/wallet";
import { walletFactory } from "@src/billing/lib/wallet/wallet";
import type { MasterWalletType } from "@src/billing/types/wallet.type";

export const MANAGED_MASTER_WALLET: InjectionToken<Wallet> = "MANAGED_MASTER_WALLET";
container.register(MANAGED_MASTER_WALLET, { useFactory: instancePerContainerCachingFactory(c => c.resolve(WALLET_FACTORY)(config.MASTER_WALLET_MNEMONIC)) });

export const InjectWallet = (walletType: MasterWalletType) => inject(`${walletType}_MASTER_WALLET`);

export const WALLET_FACTORY: InjectionToken<WalletFactory> = "WALLET_FACTORY";
container.register(WALLET_FACTORY, {
  useValue: walletFactory
});
