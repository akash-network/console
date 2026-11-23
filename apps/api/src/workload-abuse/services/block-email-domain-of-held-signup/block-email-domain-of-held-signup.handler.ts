import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { BlockEmailDomainOfHeldSignup } from "@src/workload-abuse/events/block-email-domain-of-held-signup";
import { EmailDomainBlockService } from "@src/workload-abuse/services/email-domain-block/email-domain-block.service";
import { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";

@singleton()
export class BlockEmailDomainOfHeldSignupHandler implements JobHandler<BlockEmailDomainOfHeldSignup> {
  public readonly accepts = BlockEmailDomainOfHeldSignup;

  public readonly concurrency = 1;

  public readonly policy = "stately";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly emailDomainBlockService: EmailDomainBlockService,
    private readonly instrumentation: WorkloadAbuseInstrumentationService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: BlockEmailDomainOfHeldSignupHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<BlockEmailDomainOfHeldSignup>): Promise<void> {
    const { userId, evidence } = payload;

    try {
      await this.emailDomainBlockService.blockDomainOfHeldSignup(userId, evidence);
    } catch (error) {
      this.instrumentation.recordDomainBlock("failed");
      this.logger.error({ event: "EMAIL_DOMAIN_AUTO_BLOCK_FAILED", trigger: "held_signup", userId, error });
      throw error;
    }
  }
}
