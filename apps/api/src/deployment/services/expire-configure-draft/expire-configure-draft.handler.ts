import { addHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { ConfigureDraftRepository } from "@src/deployment/repositories/configure-draft/configure-draft.repository";

/** How long a draft is kept after it was last saved. */
export const CONFIGURE_DRAFT_TTL_DAYS = 30;

export class ExpireConfigureDraft implements Job {
  static readonly [JOB_NAME] = "ExpireConfigureDraft";
  readonly name = ExpireConfigureDraft[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { configureDraftId: string }) {}
}

export function expireConfigureDraftKeyFor(configureDraftId: string): string {
  return `expireConfigureDraft.${configureDraftId}`;
}

/** Counted in hours, so a daylight saving change inside the window does not move the expiry by one. */
export function configureDraftExpiryOf(updatedAt: Date): Date {
  return addHours(updatedAt, CONFIGURE_DRAFT_TTL_DAYS * 24);
}

@singleton()
export class ExpireConfigureDraftHandler implements JobHandler<ExpireConfigureDraft> {
  public readonly accepts = ExpireConfigureDraft;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly configureDraftRepository: ConfigureDraftRepository,
    private readonly jobQueueService: JobQueueService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ExpireConfigureDraftHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** A draft saved since this was scheduled is checked again when its new expiry comes, rather than dropped while still in use. */
  async handle({ configureDraftId }: JobPayload<ExpireConfigureDraft>): Promise<void> {
    const draft = await this.configureDraftRepository.findById(configureDraftId);
    if (!draft) return;

    const expiresAt = configureDraftExpiryOf(draft.updatedAt);
    if (expiresAt > new Date()) {
      await this.jobQueueService.enqueue(new ExpireConfigureDraft({ configureDraftId }), {
        singletonKey: expireConfigureDraftKeyFor(configureDraftId),
        startAfter: expiresAt.toISOString()
      });
      return;
    }

    await this.configureDraftRepository.deleteById(configureDraftId);
    this.logger.info({ event: "CONFIGURE_DRAFT_EXPIRED", configureDraftId });
  }
}
