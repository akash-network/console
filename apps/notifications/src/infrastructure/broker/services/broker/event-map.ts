import type { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import type { ChainBlockCreatedDto } from "@src/modules/alert/dto/chain-block-created.dto";
import type { ClosureAlertsDueDto } from "@src/modules/alert/dto/closure-alerts-due.dto";
import type { EventClosedDeploymentDto } from "@src/modules/alert/dto/event-closed-deployment.dto";
import type { EventLeaseClosedDto } from "@src/modules/alert/dto/event-lease-closed.dto";
import type { EventLeaseReclaimStartedDto } from "@src/modules/alert/dto/event-lease-reclaim-started.dto";
import type { FeedEntriesCommandDto } from "@src/modules/notifications/dto/FeedEntriesCommand.dto";
import type { NotificationCommandDto } from "@src/modules/notifications/dto/NotificationCommand.dto";

export type EventToPayload = {
  [eventKeyRegistry.createNotification]: NotificationCommandDto;
  [eventKeyRegistry.blockCreated]: ChainBlockCreatedDto;
  [eventKeyRegistry.eventCloseDeployment]: EventClosedDeploymentDto;
  [eventKeyRegistry.eventLeaseReclaimStarted]: EventLeaseReclaimStartedDto;
  [eventKeyRegistry.eventLeaseClosed]: EventLeaseClosedDto;
  [eventKeyRegistry.closureAlertsDue]: ClosureAlertsDueDto;
  [eventKeyRegistry.addFeedEntries]: FeedEntriesCommandDto;
};
