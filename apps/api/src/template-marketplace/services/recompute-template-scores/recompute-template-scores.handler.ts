import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { scoreLookbackDays, scoreTemplates, type ScoringSettings } from "@src/template-marketplace/lib/template-scores/template-scores";
import { InjectTemplateMarketplaceConfig, type TemplateMarketplaceConfig } from "@src/template-marketplace/providers/config.provider";
import { TemplateScoreRepository } from "@src/template-marketplace/repositories/template-score/template-score.repository";
import { nextScoreWindowAt, RecomputeTemplateScores, recomputeTemplateScoresKeyFor } from "./recompute-template-scores.job";

export function scoringSettingsOf(config: TemplateMarketplaceConfig): ScoringSettings {
  return {
    trialWeight: config.TEMPLATE_SCORE_TRIAL_WEIGHT,
    popularHalfLifeDays: config.TEMPLATE_SCORE_POPULAR_HALF_LIFE_DAYS,
    popularWindowDays: config.TEMPLATE_SCORE_POPULAR_WINDOW_DAYS,
    trendingWindowDays: config.TEMPLATE_SCORE_TRENDING_WINDOW_DAYS,
    trendingMinVolume: config.TEMPLATE_SCORE_TRENDING_MIN_VOLUME
  };
}

/** Rewrites the Popular and Trending score of every template with counted mainnet usage, from the usage events alone, so a run repeats safely. */
@singleton()
export class RecomputeTemplateScoresHandler implements JobHandler<RecomputeTemplateScores> {
  public readonly accepts = RecomputeTemplateScores;

  /** One queued, retrying or running recompute per window, however many replicas seed it. */
  public readonly policy = "exclusive";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly templateScoreRepository: TemplateScoreRepository,
    @InjectTemplateMarketplaceConfig() private readonly config: TemplateMarketplaceConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: RecomputeTemplateScoresHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async scheduleNextRun(now: Date): Promise<void> {
    const windowStartsAt = nextScoreWindowAt(now, this.config.TEMPLATE_SCORE_RECOMPUTE_INTERVAL_SECONDS);

    await this.jobQueueService.enqueue(new RecomputeTemplateScores({ windowStartsAt: windowStartsAt.toISOString() }), {
      singletonKey: recomputeTemplateScoresKeyFor(windowStartsAt),
      startAfter: windowStartsAt.toISOString()
    });
  }

  /** Every replica seeds on boot, so a failure here waits for the next boot rather than keeping the workers down. */
  async seedNextRun(now: Date): Promise<void> {
    try {
      await this.scheduleNextRun(now);
    } catch (error) {
      this.logger.error({ event: "TEMPLATE_SCORE_RECOMPUTE_SCHEDULE_FAILED", error });
    }
  }

  /** The next run is queued before this one works, so a run that fails for good does not end the recomputing. */
  async handle(): Promise<void> {
    const now = new Date();
    await this.scheduleNextRun(now);

    const settings = scoringSettingsOf(this.config);
    const counted = { now, maxTemplates: this.config.TEMPLATE_SCORE_MAX_TEMPLATES };
    const userDays = await this.templateScoreRepository.findStillRunningUserDays({ ...counted, lookbackDays: scoreLookbackDays(settings) });
    const weeklyDeployers = await this.templateScoreRepository.countWeeklyDeployers({ ...counted, including: userDays });
    const { written, deleted } = await this.templateScoreRepository.replaceAll(scoreTemplates(userDays, weeklyDeployers, settings), now);

    this.logger.info({ event: "TEMPLATE_SCORES_RECOMPUTED", templates: written, deleted });
  }
}
