import { Injectable } from "@nestjs/common";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService, Handler } from "@src/infrastructure/broker";
import { ChainBlockCreatedDto } from "@src/modules/alert/dto/chain-block-created.dto";
import { EventClosedDeploymentDto } from "@src/modules/alert/dto/event-closed-deployment.dto";
import { EventLeaseReclaimStartedDto } from "@src/modules/alert/dto/event-lease-reclaim-started.dto";
import { ChainAlertService } from "@src/modules/alert/services/chain-alert/chain-alert.service";
import { DeploymentBalanceAlertsService } from "@src/modules/alert/services/deployment-balance-alerts/deployment-balance-alerts.service";
import { ReclaimAlertService } from "@src/modules/alert/services/reclaim-alert/reclaim-alert.service";
import { WalletBalanceAlertsService } from "@src/modules/alert/services/wallet-balance-alerts/wallet-balance-alerts.service";

@Injectable()
export class ChainEventsHandler {
  constructor(
    private readonly chainMessageAlertService: ChainAlertService,
    private readonly deploymentBalanceAlertsService: DeploymentBalanceAlertsService,
    private readonly walletBalanceAlertsService: WalletBalanceAlertsService,
    private readonly reclaimAlertService: ReclaimAlertService,
    private readonly brokerService: BrokerService
  ) {}

  @Handler({
    key: eventKeyRegistry.blockCreated,
    dto: ChainBlockCreatedDto
  })
  async processBlock(block: ChainBlockCreatedDto): Promise<void> {
    const results = await Promise.allSettled([
      this.deploymentBalanceAlertsService.alertFor(block, message => this.brokerService.publish(eventKeyRegistry.createNotification, message)),
      this.walletBalanceAlertsService.alertFor(block, async message => this.brokerService.publish(eventKeyRegistry.createNotification, message))
    ]);

    const errors = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    if (errors.length > 0) {
      throw new AggregateError(
        errors.map(e => e.reason),
        `Failed process block`
      );
    }
  }

  @Handler({
    key: eventKeyRegistry.eventCloseDeployment,
    dto: EventClosedDeploymentDto
  })
  async processDeploymentClosed(payload: EventClosedDeploymentDto): Promise<void> {
    await this.chainMessageAlertService.alertFor({ type: "CHAIN_EVENT", payload }, message =>
      this.brokerService.publish(eventKeyRegistry.createNotification, message)
    );
  }

  @Handler({
    key: eventKeyRegistry.eventLeaseReclaimStarted,
    dto: EventLeaseReclaimStartedDto
  })
  async processLeaseReclaimStarted(payload: EventLeaseReclaimStartedDto): Promise<void> {
    await this.reclaimAlertService.alertFor(payload, message => this.brokerService.publish(eventKeyRegistry.createNotification, message));
  }
}
