import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { InjectTemplateMarketplaceConfig, type TemplateMarketplaceConfig } from "@src/template-marketplace/providers/config.provider";
import { TemplateUsageEventRepository } from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import { TemplateImageDigestJobService } from "@src/template-marketplace/services/template-image-digest-job/template-image-digest-job.service";
import { nextImageWatchWindowAt, WatchPopularTemplateImages, watchPopularTemplateImagesKeyFor } from "./watch-popular-template-images.job";

/** Asks the registries again about the images that popular and Official public templates run today, so a digest pushed under a tag they name reaches the staff queue. */
@singleton()
export class WatchPopularTemplateImagesHandler implements JobHandler<WatchPopularTemplateImages> {
  public readonly accepts = WatchPopularTemplateImages;

  /** One queued, retrying or running watch per window, however many replicas seed it. */
  public readonly policy = "exclusive";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly templateUsageEventRepository: TemplateUsageEventRepository,
    private readonly templateImageDigestJobService: TemplateImageDigestJobService,
    @InjectTemplateMarketplaceConfig() private readonly config: TemplateMarketplaceConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: WatchPopularTemplateImagesHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async scheduleNextRun(now: Date): Promise<void> {
    const windowStartsAt = nextImageWatchWindowAt(now, this.config.TEMPLATE_IMAGE_WATCH_INTERVAL_SECONDS);

    await this.jobQueueService.enqueue(new WatchPopularTemplateImages({ windowStartsAt: windowStartsAt.toISOString() }), {
      singletonKey: watchPopularTemplateImagesKeyFor(windowStartsAt),
      startAfter: windowStartsAt.toISOString()
    });
  }

  /** Every replica seeds on boot, so a failure here waits for the next boot rather than keeping the workers down. */
  async seedNextRun(now: Date): Promise<void> {
    try {
      await this.scheduleNextRun(now);
    } catch (error) {
      this.logger.error({ event: "TEMPLATE_IMAGE_WATCH_SCHEDULE_FAILED", error });
    }
  }

  /** The next run is queued before this one works, so a run that fails for good does not end the watch. */
  async handle(): Promise<void> {
    await this.scheduleNextRun(new Date());

    const watched = await this.templateUsageEventRepository.findWatchedTemplates({
      minWeeklyDeployers: this.config.TEMPLATE_POPULAR_WEEKLY_DEPLOYERS,
      limit: this.config.TEMPLATE_IMAGE_WATCH_MAX_TEMPLATES
    });

    for (const { currentVersionId } of watched) {
      await this.templateImageDigestJobService.schedule(currentVersionId);
    }

    this.logger.info({ event: "POPULAR_TEMPLATE_IMAGES_WATCHED", templates: watched.length });
  }
}
