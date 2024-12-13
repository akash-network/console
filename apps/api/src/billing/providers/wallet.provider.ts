import { container, inject } from "tsyringe";

import { config } from "@src/billing/config";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import { MasterWalletType } from "@src/billing/types/wallet.type";

export const MANAGED_MASTER_WALLET = "MANAGED_MASTER_WALLET";
container.register(MANAGED_MASTER_WALLET, { useFactory: () => new Wallet(config.MASTER_WALLET_MNEMONIC) });

export const UAKT_TOP_UP_MASTER_WALLET = "UAKT_TOP_UP_MASTER_WALLET";
container.register(UAKT_TOP_UP_MASTER_WALLET, { useFactory: () => new Wallet(config.UAKT_TOP_UP_MASTER_WALLET_MNEMONIC) });

export const USDC_TOP_UP_MASTER_WALLET = "USDC_TOP_UP_MASTER_WALLET";
container.register(USDC_TOP_UP_MASTER_WALLET, { useFactory: () => new Wallet(config.USDC_TOP_UP_MASTER_WALLET_MNEMONIC) });

export const InjectWallet = (walletType: MasterWalletType) => inject(`${walletType}_MASTER_WALLET`);

export const resolveWallet = (walletType: MasterWalletType) => container.resolve<Wallet>(`${walletType}_MASTER_WALLET`);
