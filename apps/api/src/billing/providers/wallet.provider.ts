import { container, inject } from "tsyringe";

import { config } from "@src/billing/config";
import { MasterWalletService } from "@src/billing/services/master-wallet/master-wallet.service";
import { MasterWalletType } from "@src/billing/types/wallet.type";

export const MANAGED_MASTER_WALLET = "MANAGED_MASTER_WALLET";
container.register(MANAGED_MASTER_WALLET, { useFactory: () => new MasterWalletService(config.MASTER_WALLET_MNEMONIC) });

export const UAKT_TOP_UP_MASTER_WALLET = "TOP_UP_UAKT_MASTER_WALLET";
container.register(UAKT_TOP_UP_MASTER_WALLET, { useFactory: () => new MasterWalletService(config.UAKT_TOP_UP_MASTER_WALLET_MNEMONIC) });

export const USDC_TOP_UP_MASTER_WALLET = "TOP_UP_USDC_MASTER_WALLET";
container.register(USDC_TOP_UP_MASTER_WALLET, { useFactory: () => new MasterWalletService(config.USDC_TOP_UP_MASTER_WALLET_MNEMONIC) });

export const InjectWallet = (walletType: MasterWalletType) => inject(`${walletType}_MASTER_WALLET`);
