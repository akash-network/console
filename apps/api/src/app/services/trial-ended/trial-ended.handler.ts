import { singleton } from "tsyringe";

import { TrialEnded } from "@src/billing/events/trial-ended";
import { EventPayload, JobHandler, LoggerService } from "@src/core";
import { AccountStageService } from "@src/user/services/account-stage/account-stage.service";

@singleton()
export class TrialEndedHandler implements JobHandler<TrialEnded> {
  public readonly accepts = TrialEnded;

  constructor(
    private readonly accountStageService: AccountStageService,
    private readonly logger: LoggerService
  ) {}

  async handle(payload: EventPayload<TrialEnded>): Promise<void> {
    await this.accountStageService.advanceToRegular(payload.userId);
  }
}
