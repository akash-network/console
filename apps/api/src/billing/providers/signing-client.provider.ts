import { container, inject } from "tsyringe";

import { BatchSigningClientService } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { SyncSigningStargateClient } from "@src/billing/lib/sync-signing-stargate-client/sync-signing-stargate-client";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import {
  COMMUNITY_MASTER_WALLET,
  COMPANY_MASTER_WALLET,
  MANAGED_MASTER_WALLET,
  UAKT_TOP_UP_MASTER_WALLET,
  USDC_TOP_UP_MASTER_WALLET
} from "@src/billing/providers/wallet.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { MasterWalletType } from "@src/billing/types/wallet.type";

export const MANAGED_MASTER_SIGNING_CLIENT = "MANAGED_MASTER_SIGNING_CLIENT";
container.register(MANAGED_MASTER_SIGNING_CLIENT, {
  useFactory: c =>
    new BatchSigningClientService(
      c.resolve(BillingConfigService),
      c.resolve(MANAGED_MASTER_WALLET),
      c.resolve(TYPE_REGISTRY),
      SyncSigningStargateClient.connectWithSigner.bind(SyncSigningStargateClient),
      MANAGED_MASTER_SIGNING_CLIENT
    )
});

export const UAKT_TOP_UP_MASTER_SIGNING_CLIENT = "UAKT_TOP_UP_MASTER_SIGNING_CLIENT";
container.register(UAKT_TOP_UP_MASTER_SIGNING_CLIENT, {
  useFactory: c =>
    new BatchSigningClientService(
      c.resolve(BillingConfigService),
      c.resolve(UAKT_TOP_UP_MASTER_WALLET),
      c.resolve(TYPE_REGISTRY),
      SyncSigningStargateClient.connectWithSigner.bind(SyncSigningStargateClient),
      UAKT_TOP_UP_MASTER_SIGNING_CLIENT
    )
});

export const USDC_TOP_UP_MASTER_SIGNING_CLIENT = "USDC_TOP_UP_MASTER_SIGNING_CLIENT";
container.register(USDC_TOP_UP_MASTER_SIGNING_CLIENT, {
  useFactory: c =>
    new BatchSigningClientService(
      c.resolve(BillingConfigService),
      c.resolve(USDC_TOP_UP_MASTER_WALLET),
      c.resolve(TYPE_REGISTRY),
      SyncSigningStargateClient.connectWithSigner.bind(SyncSigningStargateClient),
      USDC_TOP_UP_MASTER_SIGNING_CLIENT
    )
});

export const COMPANY_MASTER_SIGNING_CLIENT = "COMPANY_MASTER_SIGNING_CLIENT";
container.register(COMPANY_MASTER_SIGNING_CLIENT, {
  useFactory: c =>
    new BatchSigningClientService(
      c.resolve(BillingConfigService),
      c.resolve(COMPANY_MASTER_WALLET),
      c.resolve(TYPE_REGISTRY),
      SyncSigningStargateClient.connectWithSigner.bind(SyncSigningStargateClient),
      COMPANY_MASTER_SIGNING_CLIENT
    )
});

export const COMMUNITY_MASTER_SIGNING_CLIENT = "COMMUNITY_MASTER_SIGNING_CLIENT";
container.register(COMMUNITY_MASTER_SIGNING_CLIENT, {
  useFactory: c =>
    new BatchSigningClientService(
      c.resolve(BillingConfigService),
      c.resolve(COMMUNITY_MASTER_WALLET),
      c.resolve(TYPE_REGISTRY),
      SyncSigningStargateClient.connectWithSigner.bind(SyncSigningStargateClient),
      COMMUNITY_MASTER_SIGNING_CLIENT
    )
});

export const InjectSigningClient = (walletType: MasterWalletType) => inject(`${walletType}_MASTER_SIGNING_CLIENT`);
