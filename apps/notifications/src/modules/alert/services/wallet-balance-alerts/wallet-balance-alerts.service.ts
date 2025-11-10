import { BalanceHttpService } from "@akashnetwork/http-sdk";
import { Injectable } from "@nestjs/common";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { ChainBlockCreatedDto } from "@src/modules/alert/dto/chain-block-created.dto";
import { AlertRepository, WalletBalanceAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import { AlertMessageService } from "@src/modules/alert/services/alert-message/alert-message.service";
import { ConditionsMatcherService } from "@src/modules/alert/services/conditions-matcher/conditions-matcher.service";
import type { MessageCallback } from "@src/modules/alert/types/message-callback.type";

type AlertCallback = (alert: WalletBalanceAlertOutput) => Promise<void> | void;

@Injectable()
export class WalletBalanceAlertsService {
  private readonly WALLET_BALANCE_BLOCKS_THROTTLE = 10;

  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly conditionsMatcher: ConditionsMatcherService,
    private readonly balanceHttpService: BalanceHttpService,
    private readonly alertMessageService: AlertMessageService,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(WalletBalanceAlertsService.name);
  }

  async alertFor(block: ChainBlockCreatedDto, onMessage: MessageCallback): Promise<void> {
    await this.forEachAlert(block.height, async alert => this.processSingleAlert(block, alert, onMessage));
  }

  private async forEachAlert(block: number, onAlert: AlertCallback) {
    try {
      await this.alertRepository.paginateAll({
        query: { block, type: "WALLET_BALANCE" },
        limit: 10,
        callback: async alerts => {
          await Promise.all(alerts.map(async alert => onAlert(alert)));
        }
      });
    } catch (error) {
      this.loggerService.error({
        event: "ALERT_FAILURE",
        block,
        error
      });
      throw error;
    }
  }

  private async processSingleAlert(block: ChainBlockCreatedDto, alert: WalletBalanceAlertOutput, onMessage: MessageCallback) {
    try {
      const balance = await this.balanceHttpService.getBalance(alert.params.owner, alert.params.denom);

      if (!balance) {
        this.loggerService.error({
          event: "ALERT_FAILURE",
          alert,
          error: new Error("Failed to fetch balance")
        });
        return;
      }

      const isMatching = this.conditionsMatcher.isMatching(alert.conditions, { balance: balance.amount });
      const update: Partial<WalletBalanceAlertOutput> = {
        minBlockHeight: block.height + this.WALLET_BALANCE_BLOCKS_THROTTLE
      };

      if (isMatching && alert.status === "OK") {
        update.status = "TRIGGERED";
      } else if (!isMatching && alert.status === "TRIGGERED") {
        update.status = "OK";
      }

      const updatedAlert = await this.alertRepository.updateById(alert.id, update);

      if (alert.status !== updatedAlert?.status) {
        await onMessage({
          payload: this.alertMessageService.getMessage({
            summary: alert.summary,
            description: alert.description,
            vars: {
              alert: {
                prev: alert,
                next: updatedAlert
              },
              data: balance
            }
          }),
          notificationChannelId: alert.notificationChannelId
        });
      }
    } catch (error) {
      this.loggerService.error({
        event: "ALERT_FAILURE",
        alert,
        error
      });
    }
  }
}
