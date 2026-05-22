import { singleton } from "tsyringe";

import { TrialActivated } from "@src/billing/events/trial-activated";
import { TrialEnded } from "@src/billing/events/trial-ended";
import { LoggerService } from "@src/core/providers/logging.provider";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";

const STAGE_ADVANCE_TIMEOUT_MS = 3000;

@singleton()
export class AccountStageService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly domainEvents: DomainEventsService,
    private readonly logger: LoggerService
  ) {}

  async advanceToTrial(user: UserOutput): Promise<void> {
    if (user.stage !== "onboarding") return;
    await this.userRepository.advanceStage(user.id, { from: "onboarding", to: "trial" });
  }

  async advanceToRegular(userId: UserOutput["id"]): Promise<void> {
    await this.userRepository.advanceStage(userId, { from: ["trial", "trial_legacy"], to: "regular" });
  }

  async activateTrial(user: UserOutput): Promise<void> {
    if (user.stage !== "onboarding") return;

    const outcome = await this.domainEvents.publishAndAwait(new TrialActivated({ userId: user.id }), { timeoutMs: STAGE_ADVANCE_TIMEOUT_MS });

    if (outcome.status !== "completed") {
      this.logger.warn({
        event: "ACCOUNT_STAGE_ACTIVATE_TRIAL_NOT_COMPLETED",
        userId: user.id,
        outcome
      });
    }
  }

  async endTrial(userId: UserOutput["id"]): Promise<void> {
    const outcome = await this.domainEvents.publishAndAwait(new TrialEnded({ userId }), { timeoutMs: STAGE_ADVANCE_TIMEOUT_MS });

    if (outcome.status !== "completed") {
      this.logger.warn({
        event: "ACCOUNT_STAGE_END_TRIAL_NOT_COMPLETED",
        userId,
        outcome
      });
    }
  }
}
