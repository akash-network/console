import { singleton } from "tsyringe";

import { TrialActivated } from "@src/billing/events/trial-activated";
import { EventPayload, JobHandler, LoggerService } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { AccountStageService } from "@src/user/services/account-stage/account-stage.service";

@singleton()
export class TrialActivatedHandler implements JobHandler<TrialActivated> {
  public readonly accepts = TrialActivated;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly accountStageService: AccountStageService,
    private readonly logger: LoggerService
  ) {}

  async handle(payload: EventPayload<TrialActivated>): Promise<void> {
    const user = await this.userRepository.findById(payload.userId);
    if (!user) {
      this.logger.warn({ event: "TRIAL_ACTIVATED_HANDLER_USER_NOT_FOUND", userId: payload.userId });
      return;
    }

    await this.accountStageService.advanceToTrial(user);
  }
}
