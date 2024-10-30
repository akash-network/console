import { container, inject } from "tsyringe";

import { config } from "@src/billing/config";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { MANAGED_MASTER_WALLET, UAKT_TOP_UP_MASTER_WALLET, USDC_TOP_UP_MASTER_WALLET } from "@src/billing/providers/wallet.provider";
import { MasterSigningClientService } from "@src/billing/services";
import { MasterWalletType } from "@src/billing/types/wallet.type";

export const MANAGED_MASTER_SIGNING_CLIENT = "MANAGED_MASTER_SIGNING_CLIENT";
container.register(MANAGED_MASTER_SIGNING_CLIENT, {
  useFactory: c => new MasterSigningClientService(config, c.resolve(MANAGED_MASTER_WALLET), c.resolve(TYPE_REGISTRY), MANAGED_MASTER_SIGNING_CLIENT)
});

export const UAKT_TOP_UP_MASTER_SIGNING_CLIENT = "UAKT_TOP_UP_MASTER_SIGNING_CLIENT";
container.register(UAKT_TOP_UP_MASTER_SIGNING_CLIENT, {
  useFactory: c => new MasterSigningClientService(config, c.resolve(UAKT_TOP_UP_MASTER_WALLET), c.resolve(TYPE_REGISTRY), UAKT_TOP_UP_MASTER_SIGNING_CLIENT)
});

export const USDC_TOP_UP_MASTER_SIGNING_CLIENT = "USDC_TOP_UP_MASTER_SIGNING_CLIENT";
container.register(USDC_TOP_UP_MASTER_SIGNING_CLIENT, {
  useFactory: c => new MasterSigningClientService(config, c.resolve(USDC_TOP_UP_MASTER_WALLET), c.resolve(TYPE_REGISTRY), USDC_TOP_UP_MASTER_SIGNING_CLIENT)
});

export const InjectSigningClient = (walletType: MasterWalletType) => inject(`${walletType}_MASTER_SIGNING_CLIENT`);
