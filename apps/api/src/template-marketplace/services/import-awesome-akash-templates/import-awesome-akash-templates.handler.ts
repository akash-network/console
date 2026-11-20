import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { InjectTemplateMarketplaceConfig, type TemplateMarketplaceConfig } from "@src/template-marketplace/providers/config.provider";
import { AwesomeAkashImportService } from "@src/template-marketplace/services/awesome-akash-import/awesome-akash-import.service";
import { ImportAwesomeAkashTemplates, importAwesomeAkashTemplatesKeyFor, nextTemplateImportWindowAt } from "./import-awesome-akash-templates.job";

/** Brings the awesome-akash gallery this API was built with into the template tables, from the gallery alone, so a run repeats safely. */
@singleton()
export class ImportAwesomeAkashTemplatesHandler implements JobHandler<ImportAwesomeAkashTemplates> {
  public readonly accepts = ImportAwesomeAkashTemplates;

  /** One queued, retrying or running import per window, however many replicas seed it. */
  public readonly policy = "exclusive";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly awesomeAkashImportService: AwesomeAkashImportService,
    @InjectTemplateMarketplaceConfig() private readonly config: TemplateMarketplaceConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ImportAwesomeAkashTemplatesHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async scheduleNextRun(now: Date): Promise<void> {
    const windowStartsAt = nextTemplateImportWindowAt(now, this.config.TEMPLATE_IMPORT_INTERVAL_SECONDS);

    await this.jobQueueService.enqueue(new ImportAwesomeAkashTemplates({ windowStartsAt: windowStartsAt.toISOString() }), {
      singletonKey: importAwesomeAkashTemplatesKeyFor(windowStartsAt),
      startAfter: windowStartsAt.toISOString()
    });
  }

  /** Every replica seeds on boot, so a failure here waits for the next boot rather than keeping the workers down. */
  async seedNextRun(now: Date): Promise<void> {
    try {
      await this.scheduleNextRun(now);
    } catch (error) {
      this.logger.error({ event: "TEMPLATE_IMPORT_SCHEDULE_FAILED", error });
    }
  }

  /** The next run is queued before this one works, so a run that fails for good does not end the import. */
  async handle(): Promise<void> {
    await this.scheduleNextRun(new Date());
    await this.awesomeAkashImportService.run();
  }
}
