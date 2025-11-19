import { container, instancePerContainerCachingFactory } from "tsyringe";

import { BatchSigningClientService } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { createSigningStargateClient } from "@src/billing/lib/signing-stargate-client-factory/signing-stargate-client.factory";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { FUNDING_WALLET } from "@src/billing/providers/wallet.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";

// NOTE: do not use this registration directly.
//  Access only via TxManagerService
export const FUNDING_SIGNING_CLIENT = "FUNDING_SIGNING_CLIENT";
container.register(FUNDING_SIGNING_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(BillingConfigService);
    return new BatchSigningClientService(config, c.resolve(FUNDING_WALLET), c.resolve(TYPE_REGISTRY), createSigningStargateClient, "FUNDING_SIGNING_CLIENT");
  })
});
