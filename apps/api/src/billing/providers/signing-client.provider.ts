import { container, inject, instancePerContainerCachingFactory } from "tsyringe";

import { BatchSigningClientService } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { createSigningStargateClient } from "@src/billing/lib/signing-stargate-client-factory/signing-stargate-client.factory";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { MANAGED_MASTER_WALLET } from "@src/billing/providers/wallet.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { MasterWalletType } from "@src/billing/types/wallet.type";
import { ChainErrorService } from "../services/chain-error/chain-error.service";

export const MANAGED_MASTER_SIGNING_CLIENT = "MANAGED_MASTER_SIGNING_CLIENT";
container.register(MANAGED_MASTER_SIGNING_CLIENT, {
  useFactory: instancePerContainerCachingFactory(
    c =>
      new BatchSigningClientService(
        c.resolve(BillingConfigService),
        c.resolve(MANAGED_MASTER_WALLET),
        c.resolve(TYPE_REGISTRY),
        createSigningStargateClient,
        c.resolve(ChainErrorService),
        MANAGED_MASTER_SIGNING_CLIENT
      )
  )
});

export const InjectSigningClient = (walletType: MasterWalletType) => inject(`${walletType}_MASTER_SIGNING_CLIENT`);
