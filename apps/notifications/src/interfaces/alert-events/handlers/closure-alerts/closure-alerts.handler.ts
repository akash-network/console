import { Injectable, OnModuleInit } from "@nestjs/common";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService, Handler } from "@src/infrastructure/broker";
import { ClosureAlertsDueDto } from "@src/modules/alert/dto/closure-alerts-due.dto";
import { ClosureAlertService } from "@src/modules/alert/services/closure-alert/closure-alert.service";

/** A short queue holds one waiting flush per channel while letting a running flush schedule the next one. */
const CLOSURE_ALERTS_QUEUE = { policy: "short", retryLimit: 10, retryDelay: 30, retryBackoff: true, retryDelayMax: 1800 } as const;

@Injectable()
export class ClosureAlertsHandler implements OnModuleInit {
  constructor(
    private readonly closureAlertService: ClosureAlertService,
    private readonly brokerService: BrokerService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.brokerService.createSubscribedQueue(eventKeyRegistry.closureAlertsDue, CLOSURE_ALERTS_QUEUE);
    await this.brokerService.createSubscribedQueue(eventKeyRegistry.addFeedEntries, {});
  }

  @Handler({
    key: eventKeyRegistry.closureAlertsDue,
    dto: ClosureAlertsDueDto
  })
  async flush({ notificationChannelId }: ClosureAlertsDueDto): Promise<void> {
    await this.closureAlertService.flush(notificationChannelId);
  }
}
