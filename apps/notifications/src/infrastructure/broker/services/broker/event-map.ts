import type { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import type { ChainBlockCreatedDto } from "@src/modules/alert/dto/chain-block-created.dto";
import type { EventClosedDeploymentDto } from "@src/modules/alert/dto/event-closed-deployment.dto";
import type { EventLeaseReclaimStartedDto } from "@src/modules/alert/dto/event-lease-reclaim-started.dto";
import type { AlertMessage } from "@src/modules/alert/types/message-callback.type";

export type EventToPayload = {
  [eventKeyRegistry.createNotification]: AlertMessage;
  [eventKeyRegistry.blockCreated]: ChainBlockCreatedDto;
  [eventKeyRegistry.eventCloseDeployment]: EventClosedDeploymentDto;
  [eventKeyRegistry.eventLeaseReclaimStarted]: EventLeaseReclaimStartedDto;
};
